-- Security Advisor: stop using auth.jwt() user_metadata in RLS (user-modifiable).
-- Use JWT email, auth.uid(), and phone_app_managers / restaurants ownership instead.

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.vyntex_auth_email()
returns text
language sql
stable
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

comment on function public.vyntex_auth_email() is
  'Signed-in user email from JWT top-level claim (not user_metadata).';

create or replace function public.vyntex_is_restaurant_owner(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = p_restaurant_id
      and (
        r.owner_user_id = auth.uid()
        or (
          public.vyntex_auth_email() <> ''
          and length(trim(coalesce(r.owner_email, ''))) > 0
          and lower(trim(r.owner_email)) = public.vyntex_auth_email()
        )
      )
  );
$$;

comment on function public.vyntex_is_restaurant_owner(uuid) is
  'True when the session user owns the venue (uid or verified owner_email).';

create or replace function public.vyntex_user_can_access_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vyntex_is_restaurant_owner(p_restaurant_id)
    or exists (
      select 1
      from public.phone_app_managers m
      where m.restaurant_id = p_restaurant_id
        and m.user_id = auth.uid()
    );
$$;

comment on function public.vyntex_user_can_access_restaurant(uuid) is
  'Owner or linked phone manager for the venue.';

revoke all on function public.vyntex_is_restaurant_owner(uuid) from public;
grant execute on function public.vyntex_is_restaurant_owner(uuid) to authenticated;

revoke all on function public.vyntex_user_can_access_restaurant(uuid) from public;
grant execute on function public.vyntex_user_can_access_restaurant(uuid) to authenticated;

-- ── Platform admin (email from JWT only) ──────────────────────────────────────

drop policy if exists "platform_admin_emails_select_self" on public.platform_admin_emails;
create policy "platform_admin_emails_select_self" on public.platform_admin_emails
  for select
  to authenticated
  using (
    public.vyntex_auth_email() <> ''
    and lower(email::text) = public.vyntex_auth_email()
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
    where public.vyntex_auth_email() <> ''
      and lower(p.email::text) = public.vyntex_auth_email()
  );
$$;

-- ── Restaurants RLS ─────────────────────────────────────────────────────────

drop policy if exists "vyntex_restaurants_select_self" on public.restaurants;
create policy "vyntex_restaurants_select_self"
  on public.restaurants
  for select
  to authenticated
  using (public.vyntex_user_can_access_restaurant(id));

drop policy if exists "vyntex_restaurants_update_self" on public.restaurants;
create policy "vyntex_restaurants_update_self"
  on public.restaurants
  for update
  to authenticated
  using (public.vyntex_is_restaurant_owner(id))
  with check (public.vyntex_is_restaurant_owner(id));

-- ── Phone manager tables ────────────────────────────────────────────────────

drop policy if exists "phone_invites_select_owner" on public.phone_manager_invites;
create policy "phone_invites_select_owner"
  on public.phone_manager_invites
  for select
  to authenticated
  using (public.vyntex_is_restaurant_owner(restaurant_id));

drop policy if exists "phone_invites_insert_owner" on public.phone_manager_invites;
create policy "phone_invites_insert_owner"
  on public.phone_manager_invites
  for insert
  to authenticated
  with check (public.vyntex_is_restaurant_owner(restaurant_id));

drop policy if exists "phone_app_managers_select_owner" on public.phone_app_managers;
create policy "phone_app_managers_select_owner"
  on public.phone_app_managers
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.vyntex_is_restaurant_owner(restaurant_id)
  );

drop policy if exists "phone_app_managers_delete_owner" on public.phone_app_managers;
create policy "phone_app_managers_delete_owner"
  on public.phone_app_managers
  for delete
  to authenticated
  using (public.vyntex_is_restaurant_owner(restaurant_id));

-- ── Mobile admin login events ───────────────────────────────────────────────

drop policy if exists "mobile_admin_login_events_select_owner" on public.mobile_admin_login_events;
create policy "mobile_admin_login_events_select_owner" on public.mobile_admin_login_events
  for select
  to authenticated
  using (public.vyntex_is_restaurant_owner(restaurant_id));

-- ── RPCs: owner checks + vyntex_my_restaurant ───────────────────────────────

create or replace function public.vyntex_my_restaurant()
returns setof public.restaurants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p_norm_email text;
  found_id uuid;
  meta_lic text;
  lic_norm text;
  total int;
  unclaimed int;
  gate_ok boolean;
begin
  if uid is null then
    return;
  end if;

  found_id := (
    select m.restaurant_id
    from public.phone_app_managers m
    where m.user_id = uid
    order by m.created_at asc
    limit 1
  );
  if found_id is not null then
    return query
    select * from public.restaurants r where r.id = found_id;
    return;
  end if;

  p_norm_email := public.vyntex_auth_email();
  if p_norm_email = '' then
    begin
      p_norm_email := (
        select lower(trim(coalesce(u.email::text, '')))
        from auth.users u
        where u.id = uid
      );
    exception when others then
      p_norm_email := '';
    end;
  end if;

  found_id := (
    select r.id
    from public.restaurants r
    where r.owner_user_id = uid
    order by r.created_at asc
    limit 1
  );

  if found_id is null then
    meta_lic := trim(coalesce((auth.jwt() -> 'user_metadata' ->> 'vyntex_license_key'), ''));
    if length(meta_lic) >= 8 then
      lic_norm := upper(regexp_replace(meta_lic, '[^a-zA-Z0-9]', '', 'g'));
      found_id := (
        select r.id
        from public.restaurants r
        where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = lic_norm
        order by r.created_at asc
        limit 1
      );

      if found_id is not null then
        gate_ok := coalesce((
          select
            (r.owner_user_id = uid)
            or (p_norm_email <> '' and lower(trim(coalesce(r.owner_email, ''))) = p_norm_email)
            or (
              r.owner_user_id is null
              and nullif(trim(coalesce(r.owner_email, '')), '') is null
            )
          from public.restaurants r
          where r.id = found_id
        ), false);

        if gate_ok then
          update public.restaurants r
          set
            owner_user_id = uid,
            owner_email = case
              when p_norm_email <> '' then p_norm_email
              else coalesce(r.owner_email, p_norm_email)
            end
          where r.id = found_id;
        else
          found_id := null;
        end if;
      end if;
    end if;
  end if;

  if found_id is null and p_norm_email <> '' then
    found_id := (
      select r.id
      from public.restaurants r
      where lower(trim(coalesce(r.owner_email, ''))) = p_norm_email
      order by r.created_at asc
      limit 1
    );

    if found_id is not null then
      update public.restaurants r
      set
        owner_user_id = uid,
        owner_email = p_norm_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is null and p_norm_email <> '' then
    total := (select count(*)::int from public.restaurants);
    unclaimed := (select count(*)::int from public.restaurants where owner_user_id is null);
    if total = 1 and unclaimed = 1 then
      found_id := (select r.id from public.restaurants r limit 1);
      update public.restaurants r
      set owner_user_id = uid, owner_email = p_norm_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is not null then
    return query
    select * from public.restaurants r where r.id = found_id;
  end if;
end;
$$;

create or replace function public.create_phone_manager_invite(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  new_code text := '';
  i int;
  exp timestamptz := now() + interval '7 days';
  attempts int := 0;
begin
  if uid is null then
    return '{"ok":false,"error":"not_authenticated"}'::jsonb;
  end if;

  if not public.vyntex_is_restaurant_owner(p_restaurant_id) then
    return '{"ok":false,"error":"not_allowed"}'::jsonb;
  end if;

  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    attempts := attempts + 1;
    begin
      insert into public.phone_manager_invites (restaurant_id, code, created_by, expires_at)
      values (p_restaurant_id, new_code, uid, exp);
      return (
        jsonb_build_object('code', new_code, 'expires_at', exp)
        || '{"ok":true}'::jsonb
      );
    exception when unique_violation then
      if attempts >= 12 then
        return '{"ok":false,"error":"code_collision"}'::jsonb;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.list_phone_managers_for_restaurant(p_restaurant_id uuid)
returns table (manager_user_id uuid, manager_email text, linked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if not public.vyntex_is_restaurant_owner(p_restaurant_id) then
    return;
  end if;

  return query
  select
    m.user_id as manager_user_id,
    coalesce(nullif(trim(m.email), ''), '—')::text as manager_email,
    m.created_at as linked_at
  from public.phone_app_managers m
  where m.restaurant_id = p_restaurant_id
  order by m.created_at desc;
end;
$$;

create or replace function public.revoke_phone_manager(p_restaurant_id uuid, p_manager_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return '{"ok":false,"error":"not_authenticated"}'::jsonb;
  end if;

  if not public.vyntex_is_restaurant_owner(p_restaurant_id) then
    return '{"ok":false,"error":"not_allowed"}'::jsonb;
  end if;

  delete from public.phone_app_managers
  where restaurant_id = p_restaurant_id
    and user_id = p_manager_user_id;
  get diagnostics n = row_count;

  return (jsonb_build_object('removed', n > 0) || '{"ok":true}'::jsonb);
end;
$$;

create or replace function public.phone_manager_access_still_valid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
    or exists (
      select 1
      from public.phone_app_managers m
      where m.user_id = auth.uid()
    );
$$;

create or replace function public.vyntex_admin_moderate_site_user(
  p_user_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_caller_email text;
  v_venues_deleted int := 0;
begin
  if not public.vyntex_is_platform_admin() then
    raise exception 'Not authorized to moderate site users.';
  end if;

  if p_action is null or p_action not in ('delete', 'ban') then
    raise exception 'Invalid action. Use delete or ban.';
  end if;

  v_caller_email := public.vyntex_auth_email();

  select lower(trim(u.email::text)) into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null or v_email = '' then
    raise exception 'User not found.';
  end if;

  if v_caller_email <> '' and v_email = v_caller_email then
    raise exception 'Cannot delete or ban your own account.';
  end if;

  if exists (
    select 1
    from public.platform_admin_emails p
    where lower(p.email::text) = v_email
  ) then
    raise exception 'Cannot delete or ban a platform admin account.';
  end if;

  delete from public.restaurants r
  where r.owner_user_id = p_user_id
     or (
       length(trim(coalesce(r.owner_email, ''))) > 0
       and lower(trim(r.owner_email)) = v_email
     );
  get diagnostics v_venues_deleted = row_count;

  delete from public.contact_submissions
  where lower(trim(email)) = v_email;

  delete from public.contact_replies
  where lower(trim(email)) = v_email;

  if p_action = 'ban' then
    insert into public.site_banned_emails (email, banned_user_id, banned_by_email)
    values (v_email, p_user_id, nullif(v_caller_email, ''))
    on conflict (email) do update set
      banned_user_id = excluded.banned_user_id,
      banned_by_email = excluded.banned_by_email,
      banned_at = now();
  end if;

  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'email', v_email,
    'venues_deleted', v_venues_deleted
  );
end;
$$;

create or replace function public.vyntex_claim_license_by_key(p_license text)
returns setof public.restaurants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  jwt_email text;
  jwt_name text;
  rid uuid;
  norm_key text;
  match_count int;
  updated_rows int;
begin
  if uid is null then
    raise exception 'You must be signed in to link a license.';
  end if;

  jwt_email := public.vyntex_auth_email();
  if jwt_email = '' then
    select lower(trim(coalesce(u.email::text, ''))) into jwt_email
    from auth.users u
    where u.id = uid;
  end if;

  jwt_name := trim(coalesce(
    (auth.jwt() -> 'user_metadata') ->> 'full_name',
    ''
  ));

  norm_key := upper(regexp_replace(coalesce(p_license, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm_key) < 16 then
    raise exception 'Enter a valid 16-character license key.';
  end if;

  select count(*)::int into match_count
  from public.restaurants r
  where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = norm_key;

  if match_count = 0 then
    raise exception 'License not found.';
  end if;
  if match_count > 1 then
    raise exception 'Multiple venues share this key; contact support.';
  end if;

  select r.id into rid
  from public.restaurants r
  where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = norm_key
  limit 1;

  if exists (select 1 from public.restaurants r where r.id = rid and r.owner_user_id = uid) then
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  if jwt_email <> '' and exists (
    select 1 from public.restaurants r
    where r.id = rid
      and r.owner_user_id is null
      and lower(trim(coalesce(r.owner_email, ''))) = jwt_email
  ) then
    update public.restaurants r
    set
      owner_user_id = uid,
      owner_email = jwt_email,
      owner_name = case when jwt_name <> '' then jwt_name else r.owner_name end
    where r.id = rid;
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  if exists (
    select 1 from public.restaurants r
    where r.id = rid
      and r.owner_user_id is null
      and (r.owner_email is null or length(trim(coalesce(r.owner_email, ''))) = 0)
  ) then
    update public.restaurants r
    set
      owner_user_id = uid,
      owner_email = case when jwt_email <> '' then jwt_email else r.owner_email end,
      owner_name = case when jwt_name <> '' then jwt_name else r.owner_name end,
      name = case
        when lower(trim(coalesce(r.name, ''))) = 'unassigned license' and jwt_name <> '' then jwt_name
        when lower(trim(coalesce(r.name, ''))) = 'unassigned license' then split_part(coalesce(jwt_email, 'user'), '@', 1)
        else r.name
      end
    where r.id = rid;
    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'Could not link this license; try again or contact support.';
    end if;
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  raise exception 'This license is already linked to another account.';
end;
$$;

notify pgrst, 'reload schema';
