-- Venue owner / phone manager can bind this phone as a waiter device
-- without a POS QR code. Authenticated only. Safe to re-run.
-- After apply: Dashboard → Settings → API → reload (or wait ~1 min).

create or replace function public.vyntex_owner_bind_waiter_phone(
  p_license_key text,
  p_phone_device_id text,
  p_display_name text default null,
  p_os text default null,
  p_app_version text default null
)
returns table (
  ok boolean,
  license_key text,
  restaurant_name text,
  device_row_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  r public.restaurants%rowtype;
  phone_count int;
  dname text;
  row_id uuid;
  request_headers jsonb;
  request_ip text;
  is_account boolean := false;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(coalesce(p_license_key, '')), '') is null
     or nullif(trim(coalesce(p_phone_device_id, '')), '') is null then
    raise exception 'missing_params';
  end if;

  if length(regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')) < 12 then
    raise exception 'invalid_license';
  end if;

  select *
  into r
  from public.restaurants
  where regexp_replace(upper(license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
  limit 1;

  if r.id is null then
    raise exception 'invalid_license';
  end if;
  if r.license_status <> 'active' then
    raise exception 'license_inactive';
  end if;
  if r.license_expiry is not null and r.license_expiry <= now() then
    raise exception 'license_expired';
  end if;

  if r.owner_user_id = uid then
    is_account := true;
  elsif jwt_email <> ''
     and lower(trim(coalesce(r.owner_email, ''))) = jwt_email then
    is_account := true;
  elsif to_regclass('public.phone_app_managers') is not null
     and exists (
       select 1
       from public.phone_app_managers m
       where m.restaurant_id = r.id
         and m.user_id = uid
     ) then
    is_account := true;
  end if;

  if not is_account then
    raise exception 'not_venue_owner';
  end if;

  select count(*)::int into phone_count
  from public.pos_devices d
  where d.restaurant_id = r.id
    and d.device_kind = 'waiter_phone'
    and d.disconnected_at is null;

  if phone_count >= 40
     and not exists (
       select 1 from public.pos_devices d
       where d.restaurant_id = r.id and d.device_id = p_phone_device_id
     ) then
    raise exception 'phone_limit';
  end if;

  dname := nullif(trim(coalesce(p_display_name, '')), '');
  if dname is null then
    dname := 'Phone-' || upper(substr(replace(p_phone_device_id, '-', ''), 1, 6));
  end if;
  dname := left(dname, 60);

  begin
    request_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    request_ip := nullif(trim(split_part(coalesce(
      request_headers ->> 'cf-connecting-ip',
      request_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), '');
  exception when others then
    request_ip := null;
  end;

  insert into public.pos_devices (
    restaurant_id,
    device_id,
    display_name,
    location_name,
    os,
    app_version,
    ip_address,
    device_kind,
    first_seen_at,
    last_seen_at,
    last_sync_at,
    disconnected_at,
    updated_at
  )
  values (
    r.id,
    p_phone_device_id,
    dname,
    r.name,
    nullif(trim(coalesce(p_os, '')), ''),
    nullif(trim(coalesce(p_app_version, '')), ''),
    request_ip,
    'waiter_phone',
    now(),
    now(),
    now(),
    null,
    now()
  )
  on conflict (restaurant_id, device_id) do update set
    display_name = excluded.display_name,
    location_name = coalesce(excluded.location_name, public.pos_devices.location_name),
    os = coalesce(excluded.os, public.pos_devices.os),
    app_version = coalesce(excluded.app_version, public.pos_devices.app_version),
    ip_address = coalesce(excluded.ip_address, public.pos_devices.ip_address),
    device_kind = 'waiter_phone',
    last_seen_at = now(),
    last_sync_at = now(),
    disconnected_at = null,
    updated_at = now()
  returning id into row_id;

  if to_regclass('public.pos_waiter_license_requests') is not null then
    update public.pos_waiter_license_requests q
    set status = 'cancelled',
        decided_at = now()
    where q.restaurant_id = r.id
      and q.phone_device_id = p_phone_device_id
      and q.status = 'pending';
  end if;

  return query select true, r.license_key, r.name, row_id;
end;
$$;

revoke all on function public.vyntex_owner_bind_waiter_phone(text, text, text, text, text) from public;
revoke all on function public.vyntex_owner_bind_waiter_phone(text, text, text, text, text) from anon;
grant execute on function public.vyntex_owner_bind_waiter_phone(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
