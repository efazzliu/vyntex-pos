alter table if exists public.restaurants
  add column if not exists pos_security_settings jsonb not null default '{}'::jsonb;

comment on column public.restaurants.pos_security_settings is
  'POS Security: idle session timeout and related venue security prefs. Device ID is not an auth credential.';

create or replace function public.vyntex_pos_assert_security_staff(
  p_license_key text,
  p_staff_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  srole text;
  sactive boolean;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null or p_staff_id is null then
    raise exception 'Not authorized';
  end if;

  select r.id
  into rid
  from public.restaurants r
  where regexp_replace(upper(r.license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
    and r.license_status = 'active'
    and (r.license_expiry is null or r.license_expiry > now())
  limit 1;

  if rid is null then
    raise exception 'Not authorized';
  end if;

  select s.role, s.is_active
  into srole, sactive
  from public.staff s
  where s.id = p_staff_id
    and s.restaurant_id = rid;

  if srole is null or sactive is not true or srole not in ('admin', 'manager') then
    raise exception 'Not authorized';
  end if;

  return rid;
end;
$$;

create or replace function public.vyntex_pos_list_security_devices(
  p_license_key text,
  p_staff_id uuid
)
returns table (
  id uuid,
  device_id text,
  display_name text,
  location_name text,
  os text,
  app_version text,
  ip_address text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  disconnected_at timestamptz,
  device_kind text
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
    d.location_name,
    d.os,
    d.app_version,
    d.ip_address,
    d.first_seen_at,
    d.last_seen_at,
    d.last_sync_at,
    d.disconnected_at,
    coalesce(d.device_kind, 'pos')
  from public.pos_devices d
  where d.restaurant_id = rid
    and coalesce(d.device_kind, 'pos') <> 'waiter_phone'
  order by d.last_seen_at desc;
end;
$$;

create or replace function public.vyntex_pos_revoke_device(
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
  kind text;
  next_devices jsonb;
  next_primary text;
begin
  rid := public.vyntex_pos_assert_security_staff(p_license_key, p_staff_id);
  target := nullif(trim(coalesce(p_target_device_id, '')), '');
  if target is null then
    raise exception 'Not authorized';
  end if;

  select coalesce(d.device_kind, 'pos')
  into kind
  from public.pos_devices d
  where d.restaurant_id = rid and d.device_id = target;

  if kind = 'waiter_phone' then
    raise exception 'Waiter phones are managed in the Phone app';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x.value)), '[]'::jsonb)
  into next_devices
  from jsonb_array_elements_text(coalesce(
    (select r.registered_devices from public.restaurants r where r.id = rid),
    '[]'::jsonb
  )) as x(value)
  where x.value <> target;

  select value
  into next_primary
  from jsonb_array_elements_text(next_devices)
  limit 1;

  update public.restaurants
  set registered_devices = next_devices,
      device_id = case when device_id = target then next_primary else device_id end
  where id = rid;

  update public.pos_devices
  set disconnected_at = now(), updated_at = now()
  where restaurant_id = rid and device_id = target;

  -- Device ID is the revoke target only. Auth already ran via staff UUID above.
  return true;
end;
$$;

revoke all on function public.vyntex_pos_assert_security_staff(text, uuid) from public;

revoke all on function public.vyntex_pos_list_security_devices(text, uuid) from public;
grant execute on function public.vyntex_pos_list_security_devices(text, uuid) to anon, authenticated;

revoke all on function public.vyntex_pos_revoke_device(text, uuid, text) from public;
grant execute on function public.vyntex_pos_revoke_device(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
