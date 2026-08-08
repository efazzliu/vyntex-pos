-- License-scoped POS preferences (PIN screen branding, theme) — follow the license on any device.

alter table public.restaurants
  add column if not exists pos_pin_branding jsonb;

alter table public.restaurants
  add column if not exists pos_theme text;

comment on column public.restaurants.pos_pin_branding is
  'PIN login screen branding (logo placement, offsets) shared across terminals for this license.';

comment on column public.restaurants.pos_theme is
  'POS UI theme for this license: dark | light.';

notify pgrst, 'reload schema';
