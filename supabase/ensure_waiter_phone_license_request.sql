-- Waiter phone: request access with the venue license; admin approves in POS.
-- Safe to re-run. After apply: Dashboard → Settings → API → reload (or wait ~1 min).

create table if not exists public.pos_waiter_license_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  phone_device_id text not null,
  display_name text not null default '',
  os text,
  app_version text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_device_id text,
  device_row_id uuid,
  constraint pos_waiter_license_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

alter table public.pos_waiter_license_requests
  add column if not exists display_name text not null default '';
alter table public.pos_waiter_license_requests
  add column if not exists os text;
alter table public.pos_waiter_license_requests
  add column if not exists app_version text;
alter table public.pos_waiter_license_requests
  add column if not exists decided_at timestamptz;
alter table public.pos_waiter_license_requests
  add column if not exists decided_by_device_id text;
alter table public.pos_waiter_license_requests
  add column if not exists device_row_id uuid;

create index if not exists idx_pos_waiter_license_requests_venue
  on public.pos_waiter_license_requests (restaurant_id, status, created_at desc);

create unique index if not exists idx_pos_waiter_license_requests_pending_unique
  on public.pos_waiter_license_requests (restaurant_id, phone_device_id)
  where status = 'pending';

alter table public.pos_waiter_license_requests enable row level security;

drop policy if exists "pos_waiter_license_requests_deny_all" on public.pos_waiter_license_requests;
create policy "pos_waiter_license_requests_deny_all" on public.pos_waiter_license_requests
  for all to public
  using (false)
  with check (false);

create or replace function public.vyntex_restaurant_id_for_active_license(p_license_key text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null then
    return null;
  end if;
  select r.id
  into rid
  from public.restaurants r
  where regexp_replace(upper(r.license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
    and r.license_status = 'active'
    and (r.license_expiry is null or r.license_expiry > now())
  limit 1;
  return rid;
end;
$$;

create or replace function public.vyntex_pos_authorized_restaurant(
  p_license_key text,
  p_pos_device_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null
     or nullif(trim(coalesce(p_pos_device_id, '')), '') is null then
    return null;
  end if;

  select r.id
  into rid
  from public.restaurants r
  where regexp_replace(upper(r.license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
    and r.license_status = 'active'
    and (r.license_expiry is null or r.license_expiry > now())
    and (
      r.device_id = p_pos_device_id
      or coalesce(r.registered_devices, '[]'::jsonb) ? p_pos_device_id
      or exists (
        select 1
        from public.pos_devices d
        where d.restaurant_id = r.id
          and d.device_id = p_pos_device_id
          and coalesce(d.device_kind, 'pos') = 'pos'
          and d.disconnected_at is null
      )
    )
  limit 1;

  return rid;
end;
$$;

create or replace function public.vyntex_request_waiter_phone_by_license(
  p_license_key text,
  p_phone_device_id text,
  p_display_name text default null,
  p_os text default null,
  p_app_version text default null
)
returns table (
  status text,
  restaurant_name text,
  license_key text,
  device_row_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurants%rowtype;
  existing_row uuid;
  existing_disc timestamptz;
  req public.pos_waiter_license_requests%rowtype;
  dname text;
  exp_at timestamptz;
begin
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

  select d.id, d.disconnected_at
  into existing_row, existing_disc
  from public.pos_devices d
  where d.restaurant_id = r.id
    and d.device_id = p_phone_device_id
    and d.device_kind = 'waiter_phone'
  limit 1;

  if existing_row is not null and existing_disc is null then
    return query select 'already_bound'::text, r.name, r.license_key, existing_row, null::timestamptz;
    return;
  end if;

  update public.pos_waiter_license_requests q
  set status = 'expired',
      decided_at = now()
  where q.restaurant_id = r.id
    and q.status = 'pending'
    and q.expires_at <= now();

  select *
  into req
  from public.pos_waiter_license_requests q
  where q.restaurant_id = r.id
    and q.phone_device_id = p_phone_device_id
    and q.status = 'pending'
  limit 1;

  dname := nullif(trim(coalesce(p_display_name, '')), '');
  if dname is null then
    dname := 'Phone-' || upper(substr(replace(p_phone_device_id, '-', ''), 1, 6));
  end if;
  dname := left(dname, 60);
  exp_at := now() + interval '2 hours';

  if req.id is not null then
    update public.pos_waiter_license_requests q
    set display_name = dname,
        os = nullif(trim(coalesce(p_os, '')), ''),
        app_version = nullif(trim(coalesce(p_app_version, '')), ''),
        expires_at = exp_at
    where q.id = req.id
    returning * into req;

    return query select 'pending'::text, r.name, r.license_key, null::uuid, req.expires_at;
    return;
  end if;

  insert into public.pos_waiter_license_requests (
    restaurant_id,
    phone_device_id,
    display_name,
    os,
    app_version,
    status,
    expires_at
  ) values (
    r.id,
    p_phone_device_id,
    dname,
    nullif(trim(coalesce(p_os, '')), ''),
    nullif(trim(coalesce(p_app_version, '')), ''),
    'pending',
    exp_at
  )
  returning * into req;

  return query select 'pending'::text, r.name, r.license_key, null::uuid, req.expires_at;
end;
$$;

create or replace function public.vyntex_waiter_license_request_status(
  p_license_key text,
  p_phone_device_id text
)
returns table (
  status text,
  restaurant_name text,
  license_key text,
  device_row_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurants%rowtype;
  existing_row uuid;
  existing_disc timestamptz;
  req public.pos_waiter_license_requests%rowtype;
begin
  if nullif(trim(coalesce(p_license_key, '')), '') is null
     or nullif(trim(coalesce(p_phone_device_id, '')), '') is null then
    return query select 'none'::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into r
  from public.restaurants
  where regexp_replace(upper(license_key), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(p_license_key), '[^A-Z0-9]', '', 'g')
  limit 1;

  if r.id is null then
    return query select 'none'::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  select d.id, d.disconnected_at
  into existing_row, existing_disc
  from public.pos_devices d
  where d.restaurant_id = r.id
    and d.device_id = p_phone_device_id
    and d.device_kind = 'waiter_phone'
  limit 1;

  if existing_row is not null and existing_disc is null then
    return query select 'approved'::text, r.name, r.license_key, existing_row, null::timestamptz;
    return;
  end if;

  update public.pos_waiter_license_requests q
  set status = 'expired',
      decided_at = coalesce(q.decided_at, now())
  where q.restaurant_id = r.id
    and q.phone_device_id = p_phone_device_id
    and q.status = 'pending'
    and q.expires_at <= now();

  select *
  into req
  from public.pos_waiter_license_requests q
  where q.restaurant_id = r.id
    and q.phone_device_id = p_phone_device_id
  order by q.created_at desc
  limit 1;

  if req.id is null then
    return query select 'none'::text, r.name, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if req.status = 'approved' then
    return query select 'approved'::text, r.name, r.license_key, req.device_row_id, req.expires_at;
    return;
  end if;

  if req.status = 'pending' then
    return query select 'pending'::text, r.name, r.license_key, null::uuid, req.expires_at;
    return;
  end if;

  return query select req.status, r.name, null::text, null::uuid, req.expires_at;
end;
$$;

create or replace function public.vyntex_cancel_waiter_license_request(
  p_license_key text,
  p_phone_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := public.vyntex_restaurant_id_for_active_license(p_license_key);
  if rid is null then
    return false;
  end if;

  update public.pos_waiter_license_requests q
  set status = 'cancelled',
      decided_at = now()
  where q.restaurant_id = rid
    and q.phone_device_id = p_phone_device_id
    and q.status = 'pending';

  return found;
end;
$$;

create or replace function public.vyntex_list_waiter_license_requests(
  p_license_key text,
  p_pos_device_id text
)
returns table (
  id uuid,
  phone_device_id text,
  display_name text,
  os text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := public.vyntex_pos_authorized_restaurant(p_license_key, p_pos_device_id);
  if rid is null then
    raise exception 'pos_not_authorized';
  end if;

  update public.pos_waiter_license_requests q
  set status = 'expired',
      decided_at = coalesce(q.decided_at, now())
  where q.restaurant_id = rid
    and q.status = 'pending'
    and q.expires_at <= now();

  return query
  select
    q.id,
    q.phone_device_id,
    q.display_name,
    q.os,
    q.created_at,
    q.expires_at
  from public.pos_waiter_license_requests q
  where q.restaurant_id = rid
    and q.status = 'pending'
  order by q.created_at asc;
end;
$$;

create or replace function public.vyntex_approve_waiter_license_request(
  p_license_key text,
  p_pos_device_id text,
  p_request_id uuid
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
  rid uuid;
  r public.restaurants%rowtype;
  req public.pos_waiter_license_requests%rowtype;
  phone_count int;
  dname text;
  row_id uuid;
  request_headers jsonb;
  request_ip text;
begin
  rid := public.vyntex_pos_authorized_restaurant(p_license_key, p_pos_device_id);
  if rid is null then
    raise exception 'pos_not_authorized';
  end if;

  select * into r from public.restaurants where id = rid;
  if r.id is null then
    raise exception 'pos_not_authorized';
  end if;

  select *
  into req
  from public.pos_waiter_license_requests q
  where q.id = p_request_id
    and q.restaurant_id = rid
  limit 1;

  if req.id is null then
    raise exception 'request_not_found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if req.expires_at <= now() then
    update public.pos_waiter_license_requests
    set status = 'expired', decided_at = now()
    where id = req.id;
    raise exception 'request_expired';
  end if;

  select count(*)::int into phone_count
  from public.pos_devices d
  where d.restaurant_id = r.id
    and d.device_kind = 'waiter_phone'
    and d.disconnected_at is null;

  if phone_count >= 40
     and not exists (
       select 1 from public.pos_devices d
       where d.restaurant_id = r.id and d.device_id = req.phone_device_id
     ) then
    raise exception 'phone_limit';
  end if;

  dname := nullif(trim(coalesce(req.display_name, '')), '');
  if dname is null then
    dname := 'Phone-' || upper(substr(replace(req.phone_device_id, '-', ''), 1, 6));
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
    req.phone_device_id,
    dname,
    r.name,
    req.os,
    req.app_version,
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

  update public.pos_waiter_license_requests
  set status = 'approved',
      decided_at = now(),
      decided_by_device_id = p_pos_device_id,
      device_row_id = row_id
  where id = req.id
    and status = 'pending';

  return query select true, r.license_key, r.name, row_id;
end;
$$;

create or replace function public.vyntex_reject_waiter_license_request(
  p_license_key text,
  p_pos_device_id text,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := public.vyntex_pos_authorized_restaurant(p_license_key, p_pos_device_id);
  if rid is null then
    raise exception 'pos_not_authorized';
  end if;

  update public.pos_waiter_license_requests q
  set status = 'rejected',
      decided_at = now(),
      decided_by_device_id = p_pos_device_id
  where q.id = p_request_id
    and q.restaurant_id = rid
    and q.status = 'pending';

  return found;
end;
$$;

revoke all on function public.vyntex_restaurant_id_for_active_license(text) from public;
revoke all on function public.vyntex_pos_authorized_restaurant(text, text) from public;
revoke all on function public.vyntex_request_waiter_phone_by_license(text, text, text, text, text) from public;
revoke all on function public.vyntex_waiter_license_request_status(text, text) from public;
revoke all on function public.vyntex_cancel_waiter_license_request(text, text) from public;
revoke all on function public.vyntex_list_waiter_license_requests(text, text) from public;
revoke all on function public.vyntex_approve_waiter_license_request(text, text, uuid) from public;
revoke all on function public.vyntex_reject_waiter_license_request(text, text, uuid) from public;

grant execute on function public.vyntex_request_waiter_phone_by_license(text, text, text, text, text) to anon, authenticated;
grant execute on function public.vyntex_waiter_license_request_status(text, text) to anon, authenticated;
grant execute on function public.vyntex_cancel_waiter_license_request(text, text) to anon, authenticated;
grant execute on function public.vyntex_list_waiter_license_requests(text, text) to anon, authenticated;
grant execute on function public.vyntex_approve_waiter_license_request(text, text, uuid) to anon, authenticated;
grant execute on function public.vyntex_reject_waiter_license_request(text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
