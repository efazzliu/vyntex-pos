-- Run in Supabase → SQL Editor if migration 034 was not applied yet.

alter table public.restaurants
  add column if not exists phone_access_branding jsonb;

comment on column public.restaurants.phone_access_branding is
  'Waiter phone login (access) branding shared across terminals for this license.';

notify pgrst, 'reload schema';
