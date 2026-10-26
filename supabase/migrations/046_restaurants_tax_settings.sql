alter table if exists public.restaurants
  add column if not exists pos_tax_settings jsonb not null default '{}'::jsonb;

comment on column public.restaurants.pos_tax_settings is
  'POS Tax & VAT: country-enabled rates, tax-inclusive/exclusive pricing, and configuration history.';

notify pgrst, 'reload schema';
