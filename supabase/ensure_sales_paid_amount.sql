-- Partial payments (split bills): accumulated amount paid before order is fully closed.
-- Run in Supabase SQL Editor if payOrder reports missing column.

alter table public.sales
  add column if not exists paid_amount numeric(12,2) not null default 0;

comment on column public.sales.paid_amount is 'Sum of partial payments; order closes when paid_amount >= total.';
