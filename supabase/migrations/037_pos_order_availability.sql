-- Run in Supabase → SQL Editor so Settings → Storage can enforce stock / kitchen stops on waiter orders.

alter table public.restaurants
  add column if not exists pos_enforce_availability boolean not null default false;

comment on column public.restaurants.pos_enforce_availability is
  'When true, waiters cannot order items that are out of stock or kitchen-stopped (available = false).';

notify pgrst, 'reload schema';
