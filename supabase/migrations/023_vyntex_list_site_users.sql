-- List Supabase Auth accounts for platform admins (admin → Users page).
-- Self-contained: creates platform_admin_emails + vyntex_is_platform_admin if missing.
-- After run, add your email:
--   insert into public.platform_admin_emails (email) values ('you@company.com') on conflict do nothing;

create extension if not exists citext with schema extensions;

create table if not exists public.platform_admin_emails (
  email citext primary key,
  created_at timestamptz not null default now()
);

comment on table public.platform_admin_emails is
  'Emails allowed for platform admin RPCs. Match VITE_PLATFORM_ADMIN_EMAILS.';

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

create or replace function public.vyntex_list_site_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  venue_count int,
  active_license_count int
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.vyntex_is_platform_admin() then
    raise exception 'Not authorized to list site users.';
  end if;

  return query
  select
    u.id as user_id,
    lower(trim(u.email::text)) as email,
    nullif(
      trim(coalesce(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        ''
      )),
      ''
    ) as full_name,
    u.created_at as registered_at,
    u.last_sign_in_at,
    coalesce(v.venue_count, 0)::int as venue_count,
    coalesce(v.active_license_count, 0)::int as active_license_count
  from auth.users u
  left join lateral (
    select
      count(*)::int as venue_count,
      count(*) filter (where coalesce(r.license_status, '') = 'active')::int as active_license_count
    from public.restaurants r
    where r.owner_user_id = u.id
  ) v on true
  order by u.created_at desc nulls last;
end;
$$;

revoke all on function public.vyntex_list_site_users() from public;
grant execute on function public.vyntex_list_site_users() to authenticated;

notify pgrst, 'reload schema';
