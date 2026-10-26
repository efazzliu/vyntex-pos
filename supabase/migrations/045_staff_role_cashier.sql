-- Allow cashier as a first-class POS staff role (till / payment).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.staff'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role in%';
  if cname is not null then
    execute format('alter table public.staff drop constraint %I', cname);
  end if;
end $$;

alter table public.staff
  add constraint staff_role_check
  check (role in (
    'admin',
    'manager',
    'cashier',
    'waiter',
    'inventory',
    'accountant',
    'auditor',
    'kitchen'
  ));
