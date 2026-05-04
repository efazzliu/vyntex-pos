-- Permissive RLS for POS core tables when using the anon key in dev/demo.
-- Without policies, enabling RLS blocks all access; some projects enable RLS on public schema by default.
-- Tighten for production (auth.uid(), restaurant scoping, etc.).

alter table if exists public.sales enable row level security;
alter table if exists public.sale_items enable row level security;
alter table if exists public.restaurants enable row level security;
alter table if exists public.staff enable row level security;
alter table if exists public.shifts enable row level security;
alter table if exists public.customers enable row level security;

drop policy if exists "pos_dev_sales_all" on public.sales;
create policy "pos_dev_sales_all" on public.sales for all using (true) with check (true);

drop policy if exists "pos_dev_sale_items_all" on public.sale_items;
create policy "pos_dev_sale_items_all" on public.sale_items for all using (true) with check (true);

drop policy if exists "pos_dev_restaurants_all" on public.restaurants;
create policy "pos_dev_restaurants_all" on public.restaurants for all using (true) with check (true);

drop policy if exists "pos_dev_staff_all" on public.staff;
create policy "pos_dev_staff_all" on public.staff for all using (true) with check (true);

drop policy if exists "pos_dev_shifts_all" on public.shifts;
create policy "pos_dev_shifts_all" on public.shifts for all using (true) with check (true);

drop policy if exists "pos_dev_customers_all" on public.customers;
create policy "pos_dev_customers_all" on public.customers for all using (true) with check (true);

notify pgrst, 'reload schema';
