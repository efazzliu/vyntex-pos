-- Fix open RLS if 021 was applied before platform_admin_emails existed.
-- After push: insert admin emails, e.g.
--   insert into public.platform_admin_emails (email) values ('you@company.com')
--   on conflict do nothing;

create table if not exists public.platform_admin_emails (
  email citext primary key,
  created_at timestamptz not null default now()
);

comment on table public.platform_admin_emails is
  'Emails allowed to read platform_billing_transactions. Match VITE_PLATFORM_ADMIN_EMAILS.';

alter table public.platform_admin_emails enable row level security;

drop policy if exists "platform_admin_emails_select_self" on public.platform_admin_emails;
create policy "platform_admin_emails_select_self" on public.platform_admin_emails
  for select
  to authenticated
  using (
    lower(email::text) = lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (auth.jwt() -> 'user_metadata') ->> 'email',
      ''
    )))
  );

create or replace function public.vyntex_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admin_emails p
    where lower(p.email::text) = lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (auth.jwt() -> 'user_metadata') ->> 'email',
      ''
    )))
  );
$$;

revoke all on function public.vyntex_is_platform_admin() from public;
grant execute on function public.vyntex_is_platform_admin() to authenticated;

drop policy if exists "platform_billing_select_authenticated" on public.platform_billing_transactions;
drop policy if exists "platform_billing_select_platform_admin" on public.platform_billing_transactions;
create policy "platform_billing_select_platform_admin" on public.platform_billing_transactions
  for select
  to authenticated
  using (public.vyntex_is_platform_admin());

notify pgrst, 'reload schema';
