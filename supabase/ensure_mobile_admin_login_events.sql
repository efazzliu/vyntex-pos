-- =============================================================================
-- Mobile app: admin PIN sign-in events (per location) for owner notifications.
-- Run in Supabase SQL Editor if the phone app shows no admin login alerts.
-- Requires public.restaurants (FK). POS inserts with anon key; owners read when signed in.
-- =============================================================================

create table if not exists public.mobile_admin_login_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  restaurant_name text not null,
  staff_name text not null,
  staff_role text not null default 'admin',
  is_device_admin boolean not null default false,
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mobile_admin_login_events_restaurant_created
  on public.mobile_admin_login_events (restaurant_id, created_at desc);

alter table public.mobile_admin_login_events enable row level security;

-- POS devices (often anon) can append rows, same pattern as pos_audit_logs dev policy.
drop policy if exists "mobile_admin_login_events_insert_open" on public.mobile_admin_login_events;
create policy "mobile_admin_login_events_insert_open" on public.mobile_admin_login_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "mobile_admin_login_events_select_owner" on public.mobile_admin_login_events;
create policy "mobile_admin_login_events_select_owner" on public.mobile_admin_login_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.restaurants r
      where r.id = mobile_admin_login_events.restaurant_id
        and (
          r.owner_user_id = (select auth.uid())
          or (
            length(trim(coalesce(r.owner_email, ''))) > 0
            and lower(trim(r.owner_email)) = public.vyntex_auth_email()
            and public.vyntex_auth_email() <> ''
          )
        )
    )
  );

-- Explicit privileges (some projects omit defaults; without INSERT, anon POS cannot write).
grant usage on schema public to anon, authenticated;
grant insert on table public.mobile_admin_login_events to anon, authenticated;
grant select on table public.mobile_admin_login_events to authenticated;

-- RPC: validates license server-side, writes with SECURITY DEFINER (works even when client INSERT is blocked).
create or replace function public.append_mobile_admin_login_event(
  p_license_key text,
  p_staff_name text,
  p_staff_role text,
  p_is_device_admin boolean,
  p_staff_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_restaurant_name text;
  v_key_norm text;
  new_id uuid;
begin
  if p_license_key is null or trim(p_license_key) = '' then
    raise exception 'license_key required';
  end if;

  v_key_norm := regexp_replace(upper(trim(p_license_key)), '[^A-Z0-9]', '', 'g');

  select r.id, r.name
  into v_restaurant_id, v_restaurant_name
  from public.restaurants r
  where r.license_status = 'active'
    and (
      upper(trim(r.license_key)) = upper(trim(p_license_key))
      or regexp_replace(upper(trim(r.license_key)), '[^A-Z0-9]', '', 'g') = v_key_norm
    )
  order by r.created_at asc
  limit 1;

  if v_restaurant_id is null then
    raise exception 'invalid_or_inactive_license';
  end if;

  begin
    insert into public.mobile_admin_login_events (
      restaurant_id,
      restaurant_name,
      staff_name,
      staff_role,
      is_device_admin,
      staff_id
    )
    values (
      v_restaurant_id,
      left(coalesce(v_restaurant_name, ''), 200),
      left(coalesce(p_staff_name, ''), 200),
      left(coalesce(nullif(trim(p_staff_role), ''), 'admin'), 50),
      coalesce(p_is_device_admin, false),
      p_staff_id
    )
    returning id into new_id;
  exception
    when foreign_key_violation then
      insert into public.mobile_admin_login_events (
        restaurant_id,
        restaurant_name,
        staff_name,
        staff_role,
        is_device_admin,
        staff_id
      )
      values (
        v_restaurant_id,
        left(coalesce(v_restaurant_name, ''), 200),
        left(coalesce(p_staff_name, ''), 200),
        left(coalesce(nullif(trim(p_staff_role), ''), 'admin'), 50),
        coalesce(p_is_device_admin, false),
        null
      )
      returning id into new_id;
  end;

  return new_id;
end;
$$;

revoke all on function public.append_mobile_admin_login_event(text, text, text, boolean, uuid) from public;
grant execute on function public.append_mobile_admin_login_event(text, text, text, boolean, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- Optional: Supabase Dashboard → Database → Replication → enable for
-- `mobile_admin_login_events` so the phone app gets instant updates (otherwise ~45s polling).
