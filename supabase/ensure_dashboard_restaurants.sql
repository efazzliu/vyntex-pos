-- Fix "Activate license" / setup-form inserts: add columns expected by the dashboard.
-- Supabase → SQL Editor → Run once (safe to re-run).

alter table public.restaurants
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table public.restaurants
  add column if not exists owner_email text;
alter table public.restaurants
  add column if not exists owner_name text;
alter table public.restaurants
  add column if not exists max_terminals int not null default 1;
alter table public.restaurants
  add column if not exists registered_devices jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_max_terminals_positive'
  ) then
    alter table public.restaurants
      add constraint restaurants_max_terminals_positive check (max_terminals >= 1);
  end if;
end $$;

notify pgrst, 'reload schema';
