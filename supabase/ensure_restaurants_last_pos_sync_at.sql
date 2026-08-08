alter table public.restaurants
  add column if not exists last_pos_sync_at timestamptz;

notify pgrst, 'reload schema';
