-- Run once in Supabase SQL Editor if you see:
-- "Load sale for send: column sales.order_number does not exist"
-- The POS app fills order_number with 1, 2, 3… per restaurant when creating / opening an order.
-- Also adds table_id if missing (optional link to floor tables).

alter table public.sales add column if not exists order_number int;
alter table public.sales add column if not exists table_id uuid;

-- Optional: after pos_floor_tables exists, add FK (skip if table not created yet):
-- alter table public.sales drop constraint if exists sales_table_id_fkey;
-- alter table public.sales
--   add constraint sales_table_id_fkey
--   foreign key (table_id) references public.pos_floor_tables(id);

notify pgrst, 'reload schema';
