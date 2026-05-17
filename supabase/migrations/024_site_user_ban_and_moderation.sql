-- Ban list + email check for sign-up/login. Purge/delete via RPC vyntex_admin_moderate_site_user (025).

create extension if not exists citext with schema extensions;

create table if not exists public.site_banned_emails (
  email citext primary key,
  banned_user_id uuid,
  banned_at timestamptz not null default now(),
  banned_by_email text,
  reason text
);

comment on table public.site_banned_emails is
  'Emails blocked from registering again after admin ban.';

alter table public.site_banned_emails enable row level security;

drop policy if exists "site_banned_emails_select_platform_admin" on public.site_banned_emails;
create policy "site_banned_emails_select_platform_admin" on public.site_banned_emails
  for select
  to authenticated
  using (public.vyntex_is_platform_admin());

create or replace function public.vyntex_is_email_banned(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_banned_emails b
    where lower(b.email::text) = lower(trim(coalesce(p_email, '')))
  );
$$;

revoke all on function public.vyntex_is_email_banned(text) from public;
grant execute on function public.vyntex_is_email_banned(text) to anon, authenticated;

-- Extend site users list with ban flag (Postgres cannot change OUT columns via CREATE OR REPLACE).
drop function if exists public.vyntex_list_site_users();

create function public.vyntex_list_site_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  venue_count int,
  active_license_count int,
  is_banned boolean
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
    coalesce(v.active_license_count, 0)::int as active_license_count,
    exists (
      select 1
      from public.site_banned_emails b
      where lower(b.email::text) = lower(trim(u.email::text))
    ) as is_banned
  from auth.users u
  left join lateral (
    select
      count(*)::int as venue_count,
      count(*) filter (where coalesce(r.license_status, '') = 'active')::int as active_license_count
    from public.restaurants r
    where r.owner_user_id = u.id
       or (
         length(trim(coalesce(r.owner_email, ''))) > 0
         and lower(trim(r.owner_email)) = lower(trim(u.email::text))
       )
  ) v on true
  order by u.created_at desc nulls last;
end;
$$;

revoke all on function public.vyntex_list_site_users() from public;
grant execute on function public.vyntex_list_site_users() to authenticated;

notify pgrst, 'reload schema';
