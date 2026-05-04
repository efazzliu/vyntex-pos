-- Phone app: owners generate Netflix-style codes so managers can link this Supabase account to a venue.
-- Run in Supabase SQL Editor after deploy.

create table if not exists public.phone_manager_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint phone_manager_invites_code_unique unique (code)
);

create index if not exists phone_manager_invites_code_idx
  on public.phone_manager_invites (upper(trim(code)));

alter table public.phone_manager_invites enable row level security;

-- Owners: see invites for their restaurants
drop policy if exists "phone_invites_select_owner" on public.phone_manager_invites;
create policy "phone_invites_select_owner"
  on public.phone_manager_invites
  for select
  to authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = phone_manager_invites.restaurant_id
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

-- Owners: create invites
drop policy if exists "phone_invites_insert_owner" on public.phone_manager_invites;
create policy "phone_invites_insert_owner"
  on public.phone_manager_invites
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
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

-- Redeem updates via RPC only (no direct update policy for clients)

create or replace function public.create_phone_manager_invite(p_restaurant_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_match boolean;
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  new_code text := '';
  i int;
  exp timestamptz := now() + interval '7 days';
begin
  if uid is null then
    raise exception 'Not authenticated';
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
    raise exception 'Not allowed for this venue';
  end if;

  for i in 1..8 loop
    new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;

  insert into public.phone_manager_invites (restaurant_id, code, created_by, expires_at)
  values (p_restaurant_id, new_code, uid, exp);

  return query select new_code, exp;
end;
$$;

revoke all on function public.create_phone_manager_invite(uuid) from public;
grant execute on function public.create_phone_manager_invite(uuid) to authenticated;

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

  update public.phone_manager_invites
  set redeemed_at = now(),
      redeemed_by = uid
  where id = invite_rec.id;

  return (
    jsonb_build_object(
      'restaurant_id', rid,
      'license_key', upper(trim(coalesce(lic, ''))),
      'restaurant_name', rname
    ) || '{"ok":true}'::jsonb
  );
end;
$$;

revoke all on function public.redeem_phone_manager_invite(text) from public;
grant execute on function public.redeem_phone_manager_invite(text) to authenticated;

notify pgrst, 'reload schema';
