-- Home_Made — schéma de gestion de stock
-- À exécuter dans Supabase: SQL Editor -> New Query -> coller -> Run

create extension if not exists "pgcrypto";

-- =========================================================================
-- chantiers: projets (terrasses) auxquels les sorties matériaux peuvent être
-- rattachées. Permet de calculer le coût matière par chantier.
-- =========================================================================
create table if not exists public.chantiers (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  client      text,
  address     text,
  status      text not null default 'actif'
              check (status in ('actif','termine','archive')),
  started_on  date,
  closed_on   date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists chantiers_status_idx on public.chantiers(status);

-- =========================================================================
-- items: une ligne par référence (modèle d'article).
-- Le champ sku sert de payload du QR-code.
-- quantity et avg_unit_cost sont maintenus automatiquement par le trigger.
-- =========================================================================
create table if not exists public.items (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  name            text not null,
  category        text,
  unit            text not null default 'pcs',
  supplier        text,
  min_stock       numeric not null default 0,
  notes           text,
  quantity        numeric not null default 0,
  avg_unit_cost   numeric not null default 0,
  total_value     numeric generated always as (quantity * avg_unit_cost) stored,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists items_sku_idx       on public.items (sku);
create index if not exists items_category_idx  on public.items (category);
create index if not exists items_archived_idx  on public.items (archived);

-- =========================================================================
-- movements: chaque entrée (IN, achat) ou sortie (OUT, utilisation chantier)
-- =========================================================================
create table if not exists public.movements (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.items(id) on delete cascade,
  kind             text not null check (kind in ('IN','OUT')),
  quantity         numeric not null check (quantity > 0),
  unit_cost        numeric,
  cost_at_movement numeric,
  site             text,
  chantier_id      uuid references public.chantiers(id),
  note             text,
  voided_at        timestamptz,
  voided_reason    text,
  created_at       timestamptz not null default now()
);

create index if not exists movements_item_idx     on public.movements (item_id);
create index if not exists movements_created_idx  on public.movements (created_at desc);
create index if not exists movements_voided_idx   on public.movements (voided_at);
create index if not exists movements_chantier_idx on public.movements (chantier_id);

-- BEFORE INSERT: snapshot CMUP au moment du mouvement (utile pour OUT).
create or replace function public.before_movement()
returns trigger
language plpgsql
as $$
declare
  current_avg numeric;
begin
  if new.kind = 'IN' then
    new.cost_at_movement := new.unit_cost;
  else
    select avg_unit_cost into current_avg
      from public.items where id = new.item_id;
    new.cost_at_movement := coalesce(current_avg, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_before_movement on public.movements;
create trigger trg_before_movement
before insert on public.movements
for each row execute function public.before_movement();

-- =========================================================================
-- Trigger: maintient quantity et avg_unit_cost (méthode CMUP).
-- IN  : nouvelle qty = qty + qty_in, nouveau coût = (val + qty_in*pu) / nouvelle qty
-- OUT : nouvelle qty = qty - qty_out, coût moyen inchangé
-- =========================================================================
create or replace function public.apply_movement()
returns trigger
language plpgsql
as $$
declare
  current_qty   numeric;
  current_avg   numeric;
  new_qty       numeric;
  new_avg       numeric;
begin
  if tg_op = 'INSERT' then
    if new.voided_at is not null then
      return new;
    end if;

    select quantity, avg_unit_cost into current_qty, current_avg
    from public.items where id = new.item_id for update;

    if current_qty is null then
      raise exception 'Item % introuvable', new.item_id;
    end if;

    if new.kind = 'IN' then
      if new.unit_cost is null or new.unit_cost < 0 then
        raise exception 'unit_cost requis et >= 0 pour une entrée IN';
      end if;
      new_qty := current_qty + new.quantity;
      if new_qty = 0 then
        new_avg := 0;
      else
        new_avg := ((current_qty * current_avg) + (new.quantity * new.unit_cost)) / new_qty;
      end if;
    else  -- OUT
      new_qty := current_qty - new.quantity;
      if new_qty < 0 then
        raise exception 'Stock insuffisant: % en stock, sortie demandée %', current_qty, new.quantity;
      end if;
      new_avg := current_avg;
    end if;

    update public.items
       set quantity = new_qty,
           avg_unit_cost = new_avg,
           updated_at = now()
     where id = new.item_id;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_apply_movement on public.movements;
create trigger trg_apply_movement
after insert on public.movements
for each row
execute function public.apply_movement();

-- =========================================================================
-- recompute_item: recalcule quantity et avg_unit_cost à partir de l'historique
-- non annulé. Utilisé quand on annule (void) un mouvement.
-- =========================================================================
create or replace function public.recompute_item(p_item uuid)
returns void
language plpgsql
as $$
declare
  q numeric := 0;
  c numeric := 0;
  r record;
begin
  for r in
    select id, kind, quantity, unit_cost
      from public.movements
     where item_id = p_item and voided_at is null
     order by created_at, id
  loop
    if r.kind = 'IN' then
      if (q + r.quantity) = 0 then
        c := 0;
      else
        c := ((q * c) + (r.quantity * coalesce(r.unit_cost, 0))) / (q + r.quantity);
      end if;
      q := q + r.quantity;
      update public.movements set cost_at_movement = r.unit_cost where id = r.id;
    else
      update public.movements set cost_at_movement = c where id = r.id;
      q := q - r.quantity;
    end if;
  end loop;

  if q < 0 then
    raise exception 'Recalcul impossible: stock négatif (%) — un mouvement antérieur dépend d''un mouvement annulé.', q;
  end if;

  update public.items
     set quantity = q,
         avg_unit_cost = c,
         updated_at = now()
   where id = p_item;
end;
$$;

create or replace function public.on_movement_void()
returns trigger
language plpgsql
as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    perform public.recompute_item(new.item_id);
  elsif old.voided_at is not null and new.voided_at is null then
    perform public.recompute_item(new.item_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_void_movement on public.movements;
create trigger trg_void_movement
after update of voided_at on public.movements
for each row
execute function public.on_movement_void();

-- =========================================================================
-- Vue agrégée pour exports / vue "tableur"
-- =========================================================================
create or replace view public.items_view as
select
  i.id,
  i.sku,
  i.name,
  i.category,
  i.unit,
  i.supplier,
  i.quantity,
  i.min_stock,
  i.avg_unit_cost,
  i.total_value,
  i.archived,
  i.notes,
  i.created_at,
  i.updated_at,
  (i.quantity <= i.min_stock) as low_stock
from public.items i;

-- =========================================================================
-- Vue: coût matière par chantier
-- =========================================================================
create or replace view public.chantier_costs as
select
  c.id as chantier_id,
  c.name,
  c.status,
  count(distinct m.item_id) filter (where m.voided_at is null and m.kind = 'OUT') as nb_articles,
  coalesce(sum(m.quantity * m.cost_at_movement)
           filter (where m.voided_at is null and m.kind = 'OUT'), 0) as total_cost
from public.chantiers c
left join public.movements m on m.chantier_id = c.id
group by c.id, c.name, c.status;

-- =========================================================================
-- RLS: à adapter quand vous ajouterez l'authentification.
-- Pour démarrer rapidement (un seul utilisateur), désactivé.
-- =========================================================================
alter table public.items     disable row level security;
alter table public.movements disable row level security;
alter table public.chantiers disable row level security;
