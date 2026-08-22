-- =============================================================================
-- Fix: "Could not find the table 'public.pos_floor_tables' in the schema cache"
-- Supabase Dashboard → SQL Editor → paste ALL of this → Run
-- Needs: public.restaurants (from schema.sql / your bootstrap)
-- =============================================================================

create table if not exists public.pos_floor_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  seats int not null default 4,
  zone text not null default 'Main',
  status text not null default 'available'
    check (status in ('available', 'occupied', 'reserved', 'bill-printed')),
  pos_x int default 100,
  pos_y int default 100,
  shape text default 'square' check (shape in ('square', 'circle', 'rectangle')),
  table_scale numeric(6,2) default 1,
  table_scale_y numeric(6,2),
  created_at timestamptz not null default now()
);

alter table public.pos_floor_tables
  add column if not exists table_scale numeric(6,2) default 1;

alter table public.pos_floor_tables
  add column if not exists table_scale_y numeric(6,2);

create index if not exists idx_pos_floor_tables_restaurant on public.pos_floor_tables(restaurant_id);
create index if not exists idx_pos_floor_tables_zone on public.pos_floor_tables(restaurant_id, zone);

alter table public.pos_floor_tables enable row level security;

drop policy if exists "pos_dev_pos_floor_tables" on public.pos_floor_tables;
create policy "pos_dev_pos_floor_tables" on public.pos_floor_tables
  for all using (true) with check (true);

-- Reload API schema NOW (before optional steps that might error)
notify pgrst, 'reload schema';

-- Optional: link sales → floor table (ignored if public.sales does not exist)
do $$
begin
  alter table public.sales
    add column if not exists table_id uuid references public.pos_floor_tables(id);
  create index if not exists idx_sales_table_id on public.sales(table_id);
exception
  when undefined_table then
    raise notice 'public.sales missing — skip table_id; run 002 migration later';
end $$;

notify pgrst, 'reload schema';
