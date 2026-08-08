-- Run in Supabase → SQL Editor if migration 028 was not applied yet.

alter table public.restaurants
  add column if not exists pos_pin_branding jsonb;

alter table public.restaurants
  add column if not exists pos_theme text;

comment on column public.restaurants.pos_pin_branding is
  'PIN login screen branding shared across terminals for this license.';

comment on column public.restaurants.pos_theme is
  'POS UI theme: dark | light.';

notify pgrst, 'reload schema';
