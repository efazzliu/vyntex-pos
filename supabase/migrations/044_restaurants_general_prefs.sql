alter table if exists public.restaurants
  add column if not exists pos_general_prefs jsonb not null default '{}'::jsonb;

comment on column public.restaurants.pos_general_prefs is
  'POS General settings: date/time format, default order type, table service, receipt language.';

notify pgrst, 'reload schema';
