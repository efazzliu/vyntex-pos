-- Remaining Supabase setup for production (zaborkzrstifvzvzamef).
-- Safe to re-run. Apply via Dashboard → SQL Editor, or:
--   SUPABASE_ACCESS_TOKEN=... npm run apply:supabase-missing

-- 1) Platform admin (required for /admin)
insert into public.platform_admin_emails (email)
values ('endfazzliu@outlook.com')
on conflict do nothing;

-- 2) Z-reports table (daily close history)
create table if not exists public.pos_z_reports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  z_number int not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_z_reports_restaurant
  on public.pos_z_reports (restaurant_id);

create index if not exists idx_pos_z_reports_created
  on public.pos_z_reports (created_at desc);

alter table public.pos_z_reports enable row level security;

drop policy if exists "pos_dev_pos_z_reports" on public.pos_z_reports;
create policy "pos_dev_pos_z_reports" on public.pos_z_reports
  for all using (true) with check (true);

-- 3) Storage: admin avatars (migration 026)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-avatars',
  'admin-avatars',
  true,
  524288,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_avatars_public_read" on storage.objects;
create policy "admin_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'admin-avatars');

drop policy if exists "admin_avatars_owner_upload" on storage.objects;
create policy "admin_avatars_owner_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin_avatars_owner_update" on storage.objects;
create policy "admin_avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin_avatars_owner_delete" on storage.objects;
create policy "admin_avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) Storage: menu photos (migration 038)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "menu_photos_public_read" on storage.objects;
create policy "menu_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_upload" on storage.objects;
create policy "menu_photos_pos_upload"
  on storage.objects for insert
  with check (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_update" on storage.objects;
create policy "menu_photos_pos_update"
  on storage.objects for update
  using (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_delete" on storage.objects;
create policy "menu_photos_pos_delete"
  on storage.objects for delete
  using (bucket_id = 'menu-photos');

-- 5) Fix ambiguous license_key in waiter phone request RPCs (036)
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
  where regexp_replace(upper(restaurants.license_key), '[^A-Z0-9]', '', 'g')
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
  where regexp_replace(upper(restaurants.license_key), '[^A-Z0-9]', '', 'g')
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

grant execute on function public.vyntex_request_waiter_phone_by_license(text, text, text, text, text) to anon, authenticated;
grant execute on function public.vyntex_waiter_license_request_status(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
