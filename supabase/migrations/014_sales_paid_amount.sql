-- Partial / final payment bookkeeping on sales (see ensure_sales_paid_amount.sql).
alter table public.sales
  add column if not exists paid_amount numeric(12,2) not null default 0;

comment on column public.sales.paid_amount is 'Sum of partial payments; order closes when paid_amount >= total.';
