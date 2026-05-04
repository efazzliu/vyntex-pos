-- =============================================================================
-- Fix: "Could not find the table 'public.debt_payments' in the schema cache"
-- Needed for: borxhlinj / debt ledger, shtim klienti, pagesa borxhi.
-- Supabase Dashboard → SQL Editor → Run (requires public.restaurants, public.customers, public.staff).
-- =============================================================================

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null check (method in ('cash', 'card', 'other')),
  staff_id uuid references public.staff(id),
  staff_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_restaurant on public.debt_payments(restaurant_id);
create index if not exists idx_debt_payments_customer on public.debt_payments(customer_id);

alter table public.debt_payments enable row level security;

drop policy if exists "pos_dev_debt_payments" on public.debt_payments;
create policy "pos_dev_debt_payments" on public.debt_payments
  for all using (true) with check (true);

notify pgrst, 'reload schema';
