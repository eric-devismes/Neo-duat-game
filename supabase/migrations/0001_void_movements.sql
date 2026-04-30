-- 0001 — Annulation (void) d'un mouvement avec recalcul complet du stock
-- À exécuter une seule fois sur un projet déjà initialisé avec schema.sql.
-- Pour un projet vierge, schema.sql contient déjà tout ce qui suit.

alter table public.movements
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text;

create index if not exists movements_voided_idx on public.movements (voided_at);

-- Recalcule quantity et avg_unit_cost depuis l'historique non annulé
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
    select kind, quantity, unit_cost
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
    else
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
    -- "Restaurer" un mouvement annulé: même logique
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

-- Bypass: si un mouvement est annulé, l'INSERT trigger ne doit plus s'appliquer
-- (sinon le stock se met à jour deux fois). On modifie apply_movement pour
-- ignorer les inserts qui arriveraient déjà annulés.
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
    else
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
  end if;

  return new;
end;
$$;
