-- Ensure RLS policy exists for POS shifts table
-- Run in Supabase SQL Editor when "Start Shift" fails with RLS/permission errors.

alter table public.shifts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shifts'
      and policyname = 'pos_dev_shifts_all'
  ) then
    create policy "pos_dev_shifts_all"
      on public.shifts
      for all
      using (true)
      with check (true);
  end if;
end
$$;
