-- Run in Supabase SQL Editor to enable Enterprise Dashboard → Custom reports schedules.

alter table if exists public.restaurants
  add column if not exists dashboard_report_schedules jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_dashboard_report_schedules_array'
  ) then
    alter table public.restaurants
      add constraint restaurants_dashboard_report_schedules_array
      check (jsonb_typeof(dashboard_report_schedules) = 'array');
  end if;
end $$;

notify pgrst, 'reload schema';
