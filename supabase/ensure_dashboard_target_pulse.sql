-- Run in Supabase SQL Editor to enable Enterprise Dashboard → Target Pulse.

alter table if exists public.restaurants
  add column if not exists dashboard_target_amount numeric(12,2),
  add column if not exists dashboard_target_start_at timestamptz,
  add column if not exists dashboard_target_end_at timestamptz,
  add column if not exists dashboard_target_period text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_dashboard_target_amount_positive'
  ) then
    alter table public.restaurants
      add constraint restaurants_dashboard_target_amount_positive
      check (
        dashboard_target_amount is null
        or dashboard_target_amount > 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_dashboard_target_dates_valid'
  ) then
    alter table public.restaurants
      add constraint restaurants_dashboard_target_dates_valid
      check (
        dashboard_target_start_at is null
        or dashboard_target_end_at is null
        or dashboard_target_end_at > dashboard_target_start_at
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_dashboard_target_period_valid'
  ) then
    alter table public.restaurants
      add constraint restaurants_dashboard_target_period_valid
      check (
        dashboard_target_period is null
        or dashboard_target_period in ('month', 'six_months', 'custom')
      );
  end if;
end $$;

notify pgrst, 'reload schema';
