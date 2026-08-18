-- Track when kitchen marked a line ready and when waiter delivered it to the table.
alter table public.sale_items
  add column if not exists ready_at timestamptz;

alter table public.sale_items
  add column if not exists served_at timestamptz;

comment on column public.sale_items.ready_at is
  'When kitchen marked this line ready for pickup.';
comment on column public.sale_items.served_at is
  'When waiter marked this line delivered to the table.';
