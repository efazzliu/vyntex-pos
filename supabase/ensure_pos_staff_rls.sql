-- Ensure RLS policy exists for POS staff table
-- Run in Supabase SQL Editor when staff create/update/delete fails with RLS.

alter table public.staff enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'staff'
      and policyname = 'pos_dev_staff_all'
  ) then
    create policy "pos_dev_staff_all"
      on public.staff
      for all
      using (true)
      with check (true);
  end if;
end
$$;
