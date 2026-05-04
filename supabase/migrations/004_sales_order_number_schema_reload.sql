-- Run this in Supabase SQL Editor if you see:
-- "Could not find the 'order_number' column of 'sales' in the schema cache"
-- 1) Ensures the column exists (idempotent).
-- 2) Tells PostgREST to reload its schema cache (same as waiting ~1 min or pausing/resuming project).

alter table public.sales add column if not exists order_number int;

notify pgrst, 'reload schema';
