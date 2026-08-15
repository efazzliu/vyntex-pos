-- Run in Supabase → SQL Editor so POS Settings → Payment management syncs to waiter phones.

alter table public.restaurants
  add column if not exists pos_payment_settings jsonb;

comment on column public.restaurants.pos_payment_settings is
  'Venue payment handling: { handling: waiter|counter, counterRoles: { admin, manager, waiter } }. Phone is for orders; this decides who closes the bill.';

notify pgrst, 'reload schema';
