alter table if exists public.restaurants
  add column if not exists pos_customer_display jsonb not null default '{}'::jsonb;

comment on column public.restaurants.pos_customer_display is
  'POS Customer Display prefs: enable, what to show, welcome text, display language. Pairing is a live window/monitor, not phone pairing.';

notify pgrst, 'reload schema';
