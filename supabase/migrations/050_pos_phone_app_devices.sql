-- Phone App settings: list / rename / revoke waiter phones.
-- A revoked phone stays unauthorized until it is paired again with a new QR/code.

create or replace function public.vyntex_pos_list_waiter_phones(
  p_license_key text,
  p_staff_id uuid
)
returns table (
  id uuid,
  device_id text,
  display_name text,
  os text,
  app_version text,
  ip_address text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  disconnected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := public.vyntex_pos_assert_security_staff(p_license_key, p_staff_id);

  return query
  select
    d.id,
    d.device_id,
    d.display_name,
    d.os,
    d.app_version,
    d.ip_address,
    d.first_seen_at,
    d.last_seen_at,
    d.last_sync_at,
    d.disconnected_at
  from public.pos_devices d
  where d.restaurant_id = rid
    and coalesce(d.device_kind, 'pos') = 'waiter_phone'
  order by
    (d.disconnected_at is null) desc,
    d.last_seen_at desc;
end;
$$;

create or replace function public.vyntex_pos_revoke_waiter_phone(
  p_license_key text,
  p_staff_id uuid,
  p_target_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  target text;
begin
  rid := public.vyntex_pos_assert_security_staff(p_license_key, p_staff_id);
  target := nullif(trim(coalesce(p_target_device_id, '')), '');
  if target is null then
    raise exception 'Not authorized';
  end if;

  update public.pos_devices
  set disconnected_at = coalesce(disconnected_at, now()),
      updated_at = now()
  where restaurant_id = rid
    and device_id = target
    and coalesce(device_kind, 'pos') = 'waiter_phone';

  if not found then
    raise exception 'phone_not_found';
  end if;

  return true;
end;
$$;

create or replace function public.vyntex_pos_rename_waiter_phone(
  p_license_key text,
  p_staff_id uuid,
  p_target_device_id text,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  target text;
  dname text;
begin
  rid := public.vyntex_pos_assert_security_staff(p_license_key, p_staff_id);
  target := nullif(trim(coalesce(p_target_device_id, '')), '');
  dname := nullif(trim(coalesce(p_display_name, '')), '');
  if target is null or dname is null then
    raise exception 'Not authorized';
  end if;

  update public.pos_devices
  set display_name = left(dname, 60),
      updated_at = now()
  where restaurant_id = rid
    and device_id = target
    and coalesce(device_kind, 'pos') = 'waiter_phone';

  if not found then
    raise exception 'phone_not_found';
  end if;

  return true;
end;
$$;

-- Heartbeat must not revive a revoked waiter phone. Re-pair (claim) still can.
create or replace function public.vyntex_pos_device_heartbeat(
  p_license_key text,
  p_device_id text,
  p_os text default null,
  p_app_version text default null
)
returns table (accepted boolean, disconnected boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  existing_kind text;
  existing_disc timestamptz;
  default_name text;
  request_headers jsonb;
  request_ip text;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null
     or nullif(trim(coalesce(p_device_id, '')), '') is null then
    return query select false, false;
    return;
  end if;

  select r.id
  into rid
  from public.restaurants r
  where regexp_replace(upper(r.license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
    and r.license_status = 'active'
    and (r.license_expiry is null or r.license_expiry > now())
    and (
      r.device_id = p_device_id
      or coalesce(r.registered_devices, '[]'::jsonb) ? p_device_id
      or exists (
        select 1
        from public.pos_devices d
        where d.restaurant_id = r.id
          and d.device_id = p_device_id
          and d.device_kind = 'waiter_phone'
          and d.disconnected_at is null
      )
    )
  limit 1;

  if rid is null then
    return query select false, true;
    return;
  end if;

  select d.device_kind, d.disconnected_at
  into existing_kind, existing_disc
  from public.pos_devices d
  where d.restaurant_id = rid and d.device_id = p_device_id
  limit 1;

  if existing_kind = 'waiter_phone' and existing_disc is not null then
    return query select false, true;
    return;
  end if;

  default_name := case
    when existing_kind = 'waiter_phone' then
      'Phone-' || upper(substr(replace(p_device_id, '-', ''), 1, 6))
    else
      'POS-' || upper(substr(replace(p_device_id, '-', ''), 1, 6))
  end;

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
    rid,
    p_device_id,
    default_name,
    nullif(trim(coalesce(p_os, '')), ''),
    nullif(trim(coalesce(p_app_version, '')), ''),
    request_ip,
    coalesce(existing_kind, 'pos'),
    now(),
    now(),
    now(),
    null,
    now()
  )
  on conflict (restaurant_id, device_id) do update set
    os = coalesce(excluded.os, public.pos_devices.os),
    app_version = coalesce(excluded.app_version, public.pos_devices.app_version),
    ip_address = coalesce(excluded.ip_address, public.pos_devices.ip_address),
    last_seen_at = now(),
    last_sync_at = now(),
    disconnected_at = case
      when public.pos_devices.device_kind = 'waiter_phone'
           and public.pos_devices.disconnected_at is not null
        then public.pos_devices.disconnected_at
      else null
    end,
    updated_at = now();

  update public.restaurants
  set last_pos_sync_at = now()
  where id = rid;

  return query select true, false;
end;
$$;

revoke all on function public.vyntex_pos_list_waiter_phones(text, uuid) from public;
grant execute on function public.vyntex_pos_list_waiter_phones(text, uuid) to anon, authenticated;

revoke all on function public.vyntex_pos_revoke_waiter_phone(text, uuid, text) from public;
grant execute on function public.vyntex_pos_revoke_waiter_phone(text, uuid, text) to anon, authenticated;

revoke all on function public.vyntex_pos_rename_waiter_phone(text, uuid, text, text) from public;
grant execute on function public.vyntex_pos_rename_waiter_phone(text, uuid, text, text) to anon, authenticated;

revoke all on function public.vyntex_pos_device_heartbeat(text, text, text, text) from public;
grant execute on function public.vyntex_pos_device_heartbeat(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
