-- =============================================================================
-- Fix: "Could not find the table 'public.menu_categories' in the schema cache"
-- Also creates menu_items, pos_menus, pos_stock_logs (needed for Stock + POS menu).
-- Supabase Dashboard → SQL Editor → Run (requires public.restaurants).
-- =============================================================================

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

alter table public.menu_items
  add column if not exists staff_meal_allowed boolean not null default true;

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

create index if not exists idx_menu_categories_restaurant on public.menu_categories(restaurant_id);
create index if not exists idx_menu_items_restaurant on public.menu_items(restaurant_id);
create index if not exists idx_pos_menus_restaurant on public.pos_menus(restaurant_id);

alter table public.menu_categories enable row level security;
alter table public.pos_menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.pos_stock_logs enable row level security;

drop policy if exists "pos_dev_menu_categories" on public.menu_categories;
create policy "pos_dev_menu_categories" on public.menu_categories
  for all using (true) with check (true);

drop policy if exists "pos_dev_pos_menus" on public.pos_menus;
create policy "pos_dev_pos_menus" on public.pos_menus
  for all using (true) with check (true);

drop policy if exists "pos_dev_menu_items" on public.menu_items;
create policy "pos_dev_menu_items" on public.menu_items
  for all using (true) with check (true);

drop policy if exists "pos_dev_pos_stock_logs" on public.pos_stock_logs;
create policy "pos_dev_pos_stock_logs" on public.pos_stock_logs
  for all using (true) with check (true);

-- Category emoji for POS order tabs (see migration 013)
alter table public.menu_categories add column if not exists icon text;

notify pgrst, 'reload schema';
