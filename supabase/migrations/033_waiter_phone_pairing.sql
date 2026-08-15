-- Waiter phone pairing: POS Settings shows a short-lived QR/code;
-- phone claims it and is stored in pos_devices (device_kind = waiter_phone).
-- Waiter phones are NOT counted against restaurants.max_terminals / registered_devices.

alter table public.pos_devices
  add column if not exists device_kind text not null default 'pos';

alter table public.pos_devices
  drop constraint if exists pos_devices_device_kind_check;

alter table public.pos_devices
  add constraint pos_devices_device_kind_check
  check (device_kind in ('pos', 'waiter_phone'));

create table if not exists public.pos_waiter_pair_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null,
  created_by_device_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_device_id text,
  created_at timestamptz not null default now(),
  constraint pos_waiter_pair_codes_code_unique unique (code)
);

create index if not exists idx_pos_waiter_pair_codes_restaurant
  on public.pos_waiter_pair_codes (restaurant_id, created_at desc);

alter table public.pos_waiter_pair_codes enable row level security;

-- No direct client table access; only security-definer RPCs.
drop policy if exists "pos_waiter_pair_codes_deny_all" on public.pos_waiter_pair_codes;
create policy "pos_waiter_pair_codes_deny_all" on public.pos_waiter_pair_codes
  for all to public
  using (false)
  with check (false);

create or replace function public.vyntex_create_waiter_pair_code(
  p_license_key text,
  p_pos_device_id text
)
returns table (
  code text,
  license_key text,
  restaurant_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  rname text;
  rkey text;
  raw text;
  new_code text;
  exp_at timestamptz;
  attempt int := 0;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null
     or nullif(trim(coalesce(p_pos_device_id, '')), '') is null then
    raise exception 'missing_params';
  end if;

  select r.id, r.name, r.license_key
  into rid, rname, rkey
  from public.restaurants r
  where regexp_replace(upper(r.license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
    and r.license_status = 'active'
    and (r.license_expiry is null or r.license_expiry > now())
  limit 1;

  if rid is null then
    raise exception 'pos_not_authorized';
  end if;

  -- Expire unused codes for this venue (keep history of consumed).
  -- Qualify column names: RETURNS TABLE exposes expires_at as an OUT var.
  update public.pos_waiter_pair_codes c
  set expires_at = least(c.expires_at, now())
  where c.restaurant_id = rid
    and c.consumed_at is null
    and c.expires_at > now();

  loop
    attempt := attempt + 1;
    raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    new_code := raw;
    begin
      exp_at := now() + interval '15 minutes';
      insert into public.pos_waiter_pair_codes (
        restaurant_id, code, created_by_device_id, expires_at
      ) values (rid, new_code, p_pos_device_id, exp_at);
      exit;
    exception when unique_violation then
      if attempt >= 8 then
        raise exception 'code_gen_failed';
      end if;
    end;
  end loop;

  code := new_code;
  license_key := rkey;
  restaurant_name := rname;
  expires_at := exp_at;
  return next;
end;
$$;

create or replace function public.vyntex_claim_waiter_phone(
  p_code text,
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
  pair public.pos_waiter_pair_codes%rowtype;
  r public.restaurants%rowtype;
  phone_count int;
  dname text;
  row_id uuid;
  request_headers jsonb;
  request_ip text;
begin
  if nullif(trim(coalesce(p_code, '')), '') is null
     or nullif(trim(coalesce(p_phone_device_id, '')), '') is null then
    return query select false, null::text, null::text, null::uuid;
    return;
  end if;

  select *
  into pair
  from public.pos_waiter_pair_codes c
  where c.code = upper(regexp_replace(trim(p_code), '[^A-Z0-9]', '', 'g'))
  limit 1;

  if pair.id is null then
    return query select false, null::text, null::text, null::uuid;
    return;
  end if;

  if pair.consumed_at is not null then
    raise exception 'code_already_used';
  end if;

  if pair.expires_at <= now() then
    raise exception 'code_expired';
  end if;

  select * into r from public.restaurants where id = pair.restaurant_id;
  if r.id is null or r.license_status <> 'active' then
    raise exception 'license_inactive';
  end if;
  if r.license_expiry is not null and r.license_expiry <= now() then
    raise exception 'license_expired';
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

  update public.pos_waiter_pair_codes
  set consumed_at = now(),
      consumed_by_device_id = p_phone_device_id
  where id = pair.id
    and consumed_at is null;

  return query select true, r.license_key, r.name, row_id;
end;
$$;

-- Heartbeat: also accept paired waiter phones (not only registered_devices).
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

  select d.device_kind into existing_kind
  from public.pos_devices d
  where d.restaurant_id = rid and d.device_id = p_device_id
  limit 1;

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
    disconnected_at = null,
    updated_at = now();

  return query select true, false;
end;
$$;

grant execute on function public.vyntex_create_waiter_pair_code(text, text) to anon, authenticated;
grant execute on function public.vyntex_claim_waiter_phone(text, text, text, text, text) to anon, authenticated;
grant execute on function public.vyntex_pos_device_heartbeat(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
