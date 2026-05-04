-- =============================================================================
-- Shift expenses (waiter "Shpenzimet e turnit") — same shape as migrations/002.
-- Run this if you used ensure_pos_menu_tables.sql but never applied 002 fully.
-- Requires public.restaurants and public.staff (FK targets).
-- Supabase Dashboard → SQL Editor → Run.
-- =============================================================================

create table if not exists public.pos_expenses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id uuid not null references public.staff(id),
  staff_name text not null,
  amount numeric(12,2) not null,
  note text not null default '',
  cleared boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_expenses_restaurant on public.pos_expenses(restaurant_id);
create index if not exists idx_pos_expenses_staff on public.pos_expenses(staff_id);

alter table public.pos_expenses enable row level security;

drop policy if exists "pos_dev_pos_expenses" on public.pos_expenses;
create policy "pos_dev_pos_expenses" on public.pos_expenses
  for all using (true) with check (true);

notify pgrst, 'reload schema';
