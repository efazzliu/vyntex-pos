-- Enterprise dashboard goals and measurable kitchen preparation times.

alter table if exists public.restaurants
  add column if not exists dashboard_daily_sales_target numeric(12,2);

alter table if exists public.sale_items
  add column if not exists sent_at timestamptz;

comment on column public.restaurants.dashboard_daily_sales_target is
  'Optional daily paid-sales target used by the Enterprise dashboard.';

comment on column public.sale_items.sent_at is
  'Timestamp when the line was sent to its preparation station.';
