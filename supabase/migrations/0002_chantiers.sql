-- 0002 — Chantiers (projets) + coût matière par chantier
-- À exécuter sur un projet déjà initialisé. Pour un projet vierge,
-- schema.sql contient déjà tout ce qui suit.

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

alter table public.movements
  add column if not exists chantier_id uuid references public.chantiers(id),
  add column if not exists cost_at_movement numeric;

create index if not exists movements_chantier_idx on public.movements(chantier_id);

-- BEFORE INSERT: snapshot CMUP into cost_at_movement so chantier cost
-- reports stay correct even after future IN movements change the CMUP.
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

-- recompute_item: ré-écrit aussi cost_at_movement sur chaque OUT pour
-- garder les rapports chantiers cohérents après une annulation.
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
     set quantity = q, avg_unit_cost = c, updated_at = now()
   where id = p_item;
end;
$$;

-- Vue agrégée: coût par chantier
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

alter table public.chantiers disable row level security;
