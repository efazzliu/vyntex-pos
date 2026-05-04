-- Staff meal / consumption rows (pos_staff_consumption).
-- Run if Staff meal save fails or table is missing (full definition in migrations/002_pos_from_convex.sql).
-- Requires public.restaurants and public.staff.

create table if not exists public.pos_staff_consumption (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id uuid not null references public.staff(id),
  staff_name text not null,
  logged_by_staff_id uuid not null references public.staff(id),
  logged_by_staff_name text not null,
  items jsonb not null default '[]',
  total numeric(12,2) not null default 0,
  cleared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_staff_consumption_restaurant
  on public.pos_staff_consumption(restaurant_id);
create index if not exists idx_pos_staff_consumption_staff
  on public.pos_staff_consumption(staff_id);

alter table public.pos_staff_consumption enable row level security;

drop policy if exists "pos_dev_pos_staff_consumption" on public.pos_staff_consumption;
create policy "pos_dev_pos_staff_consumption" on public.pos_staff_consumption
  for all using (true) with check (true);

notify pgrst, 'reload schema';
