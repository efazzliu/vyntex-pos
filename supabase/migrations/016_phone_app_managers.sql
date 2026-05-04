-- Links Supabase users (phone managers) to venues after invite redeem; owners can list/revoke.
-- Run after 015_phone_manager_invites.sql

create table if not exists public.phone_app_managers (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index if not exists phone_app_managers_user_idx on public.phone_app_managers (user_id);

alter table public.phone_app_managers enable row level security;

drop policy if exists "phone_app_managers_select_owner" on public.phone_app_managers;
create policy "phone_app_managers_select_owner"
  on public.phone_app_managers
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.restaurants r
      where r.id = phone_app_managers.restaurant_id
        and (
          r.owner_user_id = (select auth.uid())
          or (
            length(trim(coalesce(r.owner_email, ''))) > 0
            and lower(trim(r.owner_email)) = lower(trim(coalesce(
              (select auth.jwt() ->> 'email'),
              (select auth.jwt() -> 'user_metadata' ->> 'email'),
              ''
            )))
          )
        )
    )
  );

drop policy if exists "phone_app_managers_delete_owner" on public.phone_app_managers;
create policy "phone_app_managers_delete_owner"
  on public.phone_app_managers
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = phone_app_managers.restaurant_id
        and (
          r.owner_user_id = (select auth.uid())
          or (
            length(trim(coalesce(r.owner_email, ''))) > 0
            and lower(trim(r.owner_email)) = lower(trim(coalesce(
              (select auth.jwt() ->> 'email'),
              (select auth.jwt() -> 'user_metadata' ->> 'email'),
              ''
            )))
          )
        )
    )
  );

-- Redeem: register manager row (replaces function from 015)
create or replace function public.redeem_phone_manager_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  norm text;
  invite_rec public.phone_manager_invites%rowtype;
  lic text;
  rname text;
  rid uuid;
  owner_uid uuid;
  em text;
begin
  if uid is null then
    return '{"ok":false,"error":"not_authenticated"}'::jsonb;
  end if;

  norm := upper(regexp_replace(trim(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'));
  if length(norm) < 6 then
    return '{"ok":false,"error":"invalid_code"}'::jsonb;
  end if;

  select * into invite_rec
  from public.phone_manager_invites
  where upper(trim(code)) = norm
  limit 1;

  if invite_rec.id is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  if invite_rec.redeemed_at is not null then
    return '{"ok":false,"error":"already_used"}'::jsonb;
  end if;

  if invite_rec.expires_at < now() then
    return '{"ok":false,"error":"expired"}'::jsonb;
  end if;

  select r.license_key, r.name, r.owner_user_id, r.id
    into lic, rname, owner_uid, rid
  from public.restaurants r
  where r.id = invite_rec.restaurant_id;

  if rid is null then
    return '{"ok":false,"error":"venue_missing"}'::jsonb;
  end if;

  if owner_uid is not null and owner_uid = uid then
    return '{"ok":false,"error":"owner_no_redeem"}'::jsonb;
  end if;

  select lower(trim(coalesce(u.email::text, ''))) into em
  from auth.users u
  where u.id = uid;

  update public.phone_manager_invites
  set redeemed_at = now(),
      redeemed_by = uid
  where id = invite_rec.id;

  insert into public.phone_app_managers (restaurant_id, user_id, email)
  values (rid, uid, nullif(em, ''))
  on conflict (restaurant_id, user_id) do update
    set email = coalesce(excluded.email, public.phone_app_managers.email);

  return (
    jsonb_build_object(
      'restaurant_id', rid,
      'license_key', upper(trim(coalesce(lic, ''))),
      'restaurant_name', rname
    ) || '{"ok":true}'::jsonb
  );
end;
$$;

create or replace function public.list_phone_managers_for_restaurant(p_restaurant_id uuid)
returns table (manager_user_id uuid, manager_email text, linked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_match boolean;
begin
  if uid is null then
    return;
  end if;

  owner_match := (
    select exists (
      select 1 from public.restaurants r
      where r.id = p_restaurant_id
        and (
          r.owner_user_id = uid
          or (
            length(trim(coalesce(r.owner_email, ''))) > 0
            and lower(trim(r.owner_email)) = lower(trim(coalesce(
              (select auth.jwt() ->> 'email'),
              (select auth.jwt() -> 'user_metadata' ->> 'email'),
              ''
            )))
          )
        )
    )
  );

  if not coalesce(owner_match, false) then
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

revoke all on function public.list_phone_managers_for_restaurant(uuid) from public;
grant execute on function public.list_phone_managers_for_restaurant(uuid) to authenticated;

create or replace function public.revoke_phone_manager(p_restaurant_id uuid, p_manager_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_match boolean;
  n int;
begin
  if uid is null then
    return '{"ok":false,"error":"not_authenticated"}'::jsonb;
  end if;

  owner_match := (
    select exists (
      select 1 from public.restaurants r
      where r.id = p_restaurant_id
        and (
          r.owner_user_id = uid
          or (
            length(trim(coalesce(r.owner_email, ''))) > 0
            and lower(trim(r.owner_email)) = lower(trim(coalesce(
              (select auth.jwt() ->> 'email'),
              (select auth.jwt() -> 'user_metadata' ->> 'email'),
              ''
            )))
          )
        )
    )
  );

  if not coalesce(owner_match, false) then
    return '{"ok":false,"error":"not_allowed"}'::jsonb;
  end if;

  delete from public.phone_app_managers
  where restaurant_id = p_restaurant_id
    and user_id = p_manager_user_id;
  get diagnostics n = row_count;

  return (jsonb_build_object('removed', n > 0) || '{"ok":true}'::jsonb);
end;
$$;

revoke all on function public.revoke_phone_manager(uuid, uuid) from public;
grant execute on function public.revoke_phone_manager(uuid, uuid) to authenticated;

-- Call from phone app: false if metadata says phone manager but row was revoked.
create or replace function public.phone_manager_access_still_valid()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid text;
  is_mgr boolean;
begin
  if uid is null then
    return true;
  end if;

  is_mgr := coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'vyntex_phone_manager')::boolean,
    false
  );
  if not is_mgr then
    return true;
  end if;

  rid := trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id', ''));
  if length(rid) < 32 then
    return false;
  end if;

  return exists (
    select 1
    from public.phone_app_managers m
    where m.user_id = uid
      and m.restaurant_id = rid::uuid
  );
end;
$$;

revoke all on function public.phone_manager_access_still_valid() from public;
grant execute on function public.phone_manager_access_still_valid() to authenticated;

notify pgrst, 'reload schema';
