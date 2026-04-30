-- 0003 — Codes-barres alternatifs (EAN-13, codes fournisseurs, etc.)
-- À exécuter sur un projet déjà initialisé. schema.sql contient déjà
-- ce qui suit pour les nouveaux projets.

create table if not exists public.item_aliases (
  code        text primary key,
  item_id     uuid not null references public.items(id) on delete cascade,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists item_aliases_item_idx on public.item_aliases (item_id);

alter table public.item_aliases disable row level security;
