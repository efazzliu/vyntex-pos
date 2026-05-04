-- POS parity with Convex: floor tables, menu, extended sales.
-- Run after 001 / schema.sql in Supabase SQL Editor.
-- WARNING: RLS policies below are permissive for anon (dev/demo). Tighten for production.

-- ── Floor tables (Convex "tables") ───────────────────────────────────────────
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
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_floor_tables_restaurant on public.pos_floor_tables(restaurant_id);
create index if not exists idx_pos_floor_tables_zone on public.pos_floor_tables(restaurant_id, zone);

-- ── Menu (Convex menuCategories / menuItems / menus) ─────────────────────────
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  color text not null default '#0066FF',
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  menu_id uuid references public.pos_menus(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  available boolean not null default true,
  display_order int not null default 0,
  station text check (station in ('kitchen', 'bar')),
  vat_rate numeric(8,4) default 0.20,
  image_url text,
  is_favorite boolean default false,
  total_sold int default 0,
  track_stock boolean default false,
  stock_unit text,
  current_stock numeric(14,3),
  low_stock_threshold numeric(14,3),
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_categories_restaurant on public.menu_categories(restaurant_id);
create index if not exists idx_menu_items_restaurant on public.menu_items(restaurant_id);
create index if not exists idx_pos_menus_restaurant on public.pos_menus(restaurant_id);

-- ── Link sales to floor tables & order numbers ───────────────────────────────
alter table public.sales add column if not exists table_id uuid references public.pos_floor_tables(id);
alter table public.sales add column if not exists order_number int;

create index if not exists idx_sales_table_id on public.sales(table_id);

alter table public.sale_items add column if not exists station text check (station in ('kitchen', 'bar'));
alter table public.sale_items add column if not exists menu_item_id uuid references public.menu_items(id);
alter table public.sale_items add column if not exists voided_at timestamptz;
alter table public.sale_items add column if not exists voided_by_staff_id uuid references public.staff(id);
alter table public.sale_items add column if not exists vat_rate numeric(8,4) default 0.20;

-- ── Printers & templates (minimal) ─────────────────────────────────────────
create table if not exists public.pos_printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bluetooth', 'network', 'usb')),
  address text not null default '',
  role text not null check (role in ('receipt', 'kitchen', 'bar')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  template_type text not null,
  toggles jsonb not null default '{}',
  labels jsonb not null default '{}',
  styles jsonb,
  printer_id uuid references public.pos_printers(id),
  created_at timestamptz not null default now(),
  unique (restaurant_id, template_type)
);

-- ── Expenses, audit, z-reports, stock logs, staff consumption (json storage) ─
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

create table if not exists public.pos_audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id uuid references public.staff(id),
  staff_name text not null,
  action text not null,
  details text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_z_reports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  z_number int not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_stock_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id),
  staff_name text not null,
  type text not null,
  change numeric(14,3) not null,
  balance_after numeric(14,3) not null,
  note text,
  created_at timestamptz not null default now()
);

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

-- ── Debt payments (Convex debtPayments) ─────────────────────────────────────
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

-- ── Dev RLS (replace in production) ──────────────────────────────────────────
alter table public.pos_floor_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.pos_menus enable row level security;
alter table public.pos_printers enable row level security;
alter table public.receipt_templates enable row level security;
alter table public.pos_expenses enable row level security;
alter table public.pos_audit_logs enable row level security;
alter table public.pos_z_reports enable row level security;
alter table public.pos_stock_logs enable row level security;
alter table public.pos_staff_consumption enable row level security;
alter table public.debt_payments enable row level security;

create policy "pos_dev_pos_floor_tables" on public.pos_floor_tables for all using (true) with check (true);
create policy "pos_dev_menu_categories" on public.menu_categories for all using (true) with check (true);
create policy "pos_dev_menu_items" on public.menu_items for all using (true) with check (true);
create policy "pos_dev_pos_menus" on public.pos_menus for all using (true) with check (true);
create policy "pos_dev_pos_printers" on public.pos_printers for all using (true) with check (true);
create policy "pos_dev_receipt_templates" on public.receipt_templates for all using (true) with check (true);
create policy "pos_dev_pos_expenses" on public.pos_expenses for all using (true) with check (true);
create policy "pos_dev_pos_audit_logs" on public.pos_audit_logs for all using (true) with check (true);
create policy "pos_dev_pos_z_reports" on public.pos_z_reports for all using (true) with check (true);
create policy "pos_dev_pos_stock_logs" on public.pos_stock_logs for all using (true) with check (true);
create policy "pos_dev_pos_staff_consumption" on public.pos_staff_consumption for all using (true) with check (true);
create policy "pos_dev_debt_payments" on public.debt_payments for all using (true) with check (true);

-- If POS queries fail on sales/staff/restaurants with anon key, add permissive RLS policies
-- for those tables in the Supabase dashboard (or run equivalent SQL there).

-- PostgREST must reload its schema cache after DDL or the API returns
-- "Could not find the 'order_number' column ... in the schema cache".
notify pgrst, 'reload schema';
