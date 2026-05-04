-- Vyntex POS - Supabase schema bootstrap
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ── Core business tables ─────────────────────────────────────────────────────

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('restaurant', 'cafe', 'bar', 'hotel', 'fitness')),
  address text,
  phone text,
  currency text not null default 'EUR',
  language text check (language in ('en', 'sq')),
  currency_symbol text,
  currency_position text check (currency_position in ('prefix', 'suffix')),
  currency_decimals int,
  plan text not null check (plan in ('starter', 'professional', 'enterprise')),
  license_key text not null unique,
  license_expiry timestamptz not null,
  license_status text not null check (license_status in ('active', 'expired', 'suspended')),
  device_id text,
  created_at timestamptz not null default now()
);

-- Dashboard license activation (setup-form) expects these columns. Idempotent for existing DBs.
alter table public.restaurants
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table public.restaurants
  add column if not exists owner_email text;
alter table public.restaurants
  add column if not exists owner_name text;
alter table public.restaurants
  add column if not exists max_terminals int not null default 1;
alter table public.restaurants
  add column if not exists registered_devices jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_max_terminals_positive'
  ) then
    alter table public.restaurants
      add constraint restaurants_max_terminals_positive check (max_terminals >= 1);
  end if;
end $$;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'manager', 'waiter', 'inventory', 'accountant', 'auditor', 'kitchen')),
  pin_hash text not null,
  is_active boolean not null default true,
  permissions jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  opening_cash numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category text,
  name text not null,
  description text,
  price numeric(12,2) not null,
  vat_rate numeric(5,4) default 0.20,
  available boolean not null default true,
  track_stock boolean not null default false,
  stock_unit text,
  current_stock numeric(12,3),
  low_stock_threshold numeric(12,3),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  credit_limit numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_ref text,
  table_id uuid,
  order_number int,
  staff_id uuid references public.staff(id),
  status text not null default 'open' check (status in ('open', 'sent-to-kitchen', 'ready', 'served', 'paid', 'cancelled')),
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_method text check (payment_method in ('cash', 'card', 'other')),
  payment_type text check (payment_type in ('fiscal', 'non_fiscal', 'no_receipt', 'debt', 'complimentary')),
  customer_id uuid references public.customers(id),
  customer_name text,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  name text not null,
  price numeric(12,2) not null,
  quantity numeric(12,3) not null default 1,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'preparing', 'ready', 'served', 'cancelled', 'voided')),
  created_at timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_staff_restaurant on public.staff(restaurant_id);
create index if not exists idx_shifts_staff_open on public.shifts(staff_id) where clock_out is null;
create index if not exists idx_products_restaurant on public.products(restaurant_id);
create index if not exists idx_sales_restaurant on public.sales(restaurant_id);
create index if not exists idx_sales_created_at on public.sales(created_at desc);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);

-- ── Convex offline queue compatibility hook ──────────────────────────────────
-- This is intentionally a stub. Replace with your own mutation router.

create or replace function public.run_pos_mutation(function_path text, payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  raise exception 'run_pos_mutation not implemented for path: %', function_path;
end;
$$;
