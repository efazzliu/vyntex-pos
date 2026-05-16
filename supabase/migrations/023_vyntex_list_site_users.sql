-- List Supabase Auth accounts for platform admins (admin → Users page).

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
