-- Last time a POS terminal synced license data to the cloud (shown on web dashboard).

alter table public.restaurants
  add column if not exists last_pos_sync_at timestamptz;

comment on column public.restaurants.last_pos_sync_at is
  'Updated when a POS device hydrates/syncs menu, staff, and settings for this license.';

notify pgrst, 'reload schema';
