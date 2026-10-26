alter table if exists public.restaurants
  add column if not exists pos_stock_rules jsonb not null default '{}'::jsonb;

comment on column public.restaurants.pos_stock_rules is
  'POS Inventory & stock rules: block vs allow out-of-stock sales, default low-stock warning threshold.';

notify pgrst, 'reload schema';
