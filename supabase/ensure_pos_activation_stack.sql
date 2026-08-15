-- Run once in Supabase → SQL Editor (fixes POS activation / device presence).
-- Safe to re-run. Order matters: columns before pos_devices seed.

-- 028: PIN branding + theme on license
alter table public.restaurants
  add column if not exists pos_pin_branding jsonb;

alter table public.restaurants
  add column if not exists pos_theme text;

-- 029: last sync timestamp
alter table public.restaurants
  add column if not exists last_pos_sync_at timestamptz;

-- 030: per-device presence
create table if not exists public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  device_id text not null,
  display_name text not null,
  location_name text,
  os text,
  app_version text,
  ip_address text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, device_id)
);

alter table public.pos_devices
  add column if not exists location_name text;

create index if not exists idx_pos_devices_restaurant
  on public.pos_devices (restaurant_id, last_seen_at desc);

alter table public.pos_devices enable row level security;

drop policy if exists "pos_devices_owner_select" on public.pos_devices;
create policy "pos_devices_owner_select" on public.pos_devices
  for select to authenticated
  using (public.vyntex_is_restaurant_owner(restaurant_id));

insert into public.pos_devices (restaurant_id, device_id, display_name, location_name, last_seen_at)
select
  r.id,
  d.device_id,
  'POS-' || lpad(d.ordinality::text, 2, '0'),
  r.name,
  coalesce(r.last_pos_sync_at, r.created_at, now())
from public.restaurants r
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(r.registered_devices) = 'array' then r.registered_devices
    else '[]'::jsonb
  end
) with ordinality as d(device_id, ordinality)
where nullif(trim(d.device_id), '') is not null
on conflict (restaurant_id, device_id) do nothing;

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
    )
  limit 1;

  if rid is null then
    return query select false, true;
    return;
  end if;

  default_name := 'POS-' || upper(substr(replace(p_device_id, '-', ''), 1, 6));
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
    restaurant_id, device_id, display_name, os, app_version, ip_address,
    first_seen_at, last_seen_at, last_sync_at, disconnected_at, updated_at
  )
  values (
    rid, p_device_id, default_name,
    nullif(trim(coalesce(p_os, '')), ''),
    nullif(trim(coalesce(p_app_version, '')), ''),
    request_ip, now(), now(), now(), null, now()
  )
  on conflict (restaurant_id, device_id) do update set
    os = coalesce(excluded.os, public.pos_devices.os),
    app_version = coalesce(excluded.app_version, public.pos_devices.app_version),
    ip_address = coalesce(excluded.ip_address, public.pos_devices.ip_address),
    last_seen_at = now(),
    last_sync_at = now(),
    disconnected_at = null,
    updated_at = now();

  update public.restaurants
  set last_pos_sync_at = now()
  where id = rid;

  return query select true, false;
end;
$$;

create or replace function public.vyntex_rename_pos_device(
  p_device_row_id uuid,
  p_display_name text,
  p_location_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
begin
  clean_name := nullif(trim(coalesce(p_display_name, '')), '');
  if clean_name is null then
    raise exception 'Device name is required';
  end if;

  update public.pos_devices d
  set display_name = left(clean_name, 60),
      location_name = nullif(left(trim(coalesce(p_location_name, '')), 80), ''),
      updated_at = now()
  where d.id = p_device_row_id
    and public.vyntex_is_restaurant_owner(d.restaurant_id);

  return found;
end;
$$;

create or replace function public.vyntex_disconnect_pos_device(
  p_restaurant_id uuid,
  p_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_devices jsonb;
  next_primary text;
begin
  if not public.vyntex_is_restaurant_owner(p_restaurant_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x.value)), '[]'::jsonb)
  into next_devices
  from jsonb_array_elements_text(coalesce(
    (select r.registered_devices from public.restaurants r where r.id = p_restaurant_id),
    '[]'::jsonb
  )) as x(value)
  where x.value <> p_device_id;

  select value
  into next_primary
  from jsonb_array_elements_text(next_devices)
  limit 1;

  update public.restaurants
  set registered_devices = next_devices,
      device_id = case when device_id = p_device_id then next_primary else device_id end
  where id = p_restaurant_id;

  update public.pos_devices
  set disconnected_at = now(), updated_at = now()
  where restaurant_id = p_restaurant_id and device_id = p_device_id;

  return found;
end;
$$;

revoke all on function public.vyntex_pos_device_heartbeat(text, text, text, text) from public;
grant execute on function public.vyntex_pos_device_heartbeat(text, text, text, text) to anon, authenticated;

revoke all on function public.vyntex_disconnect_pos_device(uuid, text) from public;
grant execute on function public.vyntex_disconnect_pos_device(uuid, text) to authenticated;

revoke all on function public.vyntex_rename_pos_device(uuid, text, text) from public;
grant execute on function public.vyntex_rename_pos_device(uuid, text, text) to authenticated;

grant select on public.pos_devices to authenticated;
revoke insert, update, delete on public.pos_devices from anon, authenticated;

notify pgrst, 'reload schema';
