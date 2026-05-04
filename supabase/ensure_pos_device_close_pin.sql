-- PIN hash for device "Quick Login" (IndexedDB) — authorizes close day when it differs from staff.pin_hash.
-- Run in Supabase → SQL Editor after public.restaurants exists.

alter table public.restaurants
  add column if not exists pos_device_close_pin_hash text;

comment on column public.restaurants.pos_device_close_pin_hash is
  'SHA-256 hex of device quick-login PIN; synced from POS when device admin PIN is used.';

notify pgrst, 'reload schema';
