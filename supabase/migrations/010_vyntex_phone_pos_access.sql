-- Migration: RPC vyntex_my_restaurant + RLS për restaurants (telefon / POS me llogari).
-- (Për SQL Editor manual: supabase/ensure_vyntex_phone_pos_access.sql)

-- Telefon / POS me llogari: ekzekuto të gjithë skriptin në Supabase → SQL Editor (një herë ose pas ndryshimesh).
-- 1) Funksioni vyntex_my_restaurant (anashkalon RLS)
-- 2) Politika RLS që lejojnë lexim/përditësim kur RLS është aktiv pa policy "dev open"

-- ── A) RPC ───────────────────────────────────────────────────────────────────

create or replace function public.vyntex_my_restaurant()
returns setof public.restaurants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  jwt_email text;
  found_id uuid;
  meta_text text;
  meta_lic text;
  lic_norm text;
  total int;
  unclaimed int;
  gate_ok boolean;
begin
  if uid is null then
    return;
  end if;

  jwt_email := lower(trim(coalesce(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata') ->> 'email',
    ''
  )));

  if jwt_email = '' then
    begin
      select lower(trim(coalesce(u.email::text, ''))) into jwt_email
      from auth.users u
      where u.id = uid;
    exception when others then
      jwt_email := '';
    end;
  end if;

  select r.id into found_id
  from public.restaurants r
  where r.owner_user_id = uid
  order by r.created_at asc
  limit 1;

  if found_id is null then
    meta_text := (auth.jwt() -> 'user_metadata') ->> 'vyntex_restaurant_id';
    if meta_text is not null and btrim(meta_text) <> '' then
      begin
        found_id := btrim(meta_text)::uuid;
      exception when invalid_text_representation then
        found_id := null;
      end;
      if found_id is not null and not exists (select 1 from public.restaurants r where r.id = found_id) then
        found_id := null;
      end if;
      if found_id is not null then
        update public.restaurants r
        set
          owner_user_id = uid,
          owner_email = case
            when jwt_email <> '' then jwt_email
            else coalesce(r.owner_email, jwt_email)
          end
        where r.id = found_id;
      end if;
    end if;
  end if;

  if found_id is null then
    meta_lic := trim(coalesce((auth.jwt() -> 'user_metadata' ->> 'vyntex_license_key'), ''));
    if length(meta_lic) >= 8 then
      lic_norm := upper(regexp_replace(meta_lic, '[^a-zA-Z0-9]', '', 'g'));
      select r.id into found_id
      from public.restaurants r
      where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = lic_norm
      order by r.created_at asc
      limit 1;

      if found_id is not null then
        select
          (r.owner_user_id = uid)
          or (jwt_email <> '' and lower(trim(coalesce(r.owner_email, ''))) = jwt_email)
          or (
            r.owner_user_id is null
            and nullif(trim(coalesce(r.owner_email, '')), '') is null
          )
        into gate_ok
        from public.restaurants r
        where r.id = found_id;

        if coalesce(gate_ok, false) then
          update public.restaurants r
          set
            owner_user_id = uid,
            owner_email = case
              when jwt_email <> '' then jwt_email
              else coalesce(r.owner_email, jwt_email)
            end
          where r.id = found_id;
        else
          found_id := null;
        end if;
      end if;
    end if;
  end if;

  if found_id is null and jwt_email <> '' then
    select r.id into found_id
    from public.restaurants r
    where lower(trim(coalesce(r.owner_email, ''))) = jwt_email
    order by r.created_at asc
    limit 1;

    if found_id is not null then
      update public.restaurants r
      set
        owner_user_id = uid,
        owner_email = jwt_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is null and jwt_email <> '' then
    select count(*)::int into total from public.restaurants;
    select count(*)::int into unclaimed
    from public.restaurants
    where owner_user_id is null;
    if total = 1 and unclaimed = 1 then
      select r.id into found_id from public.restaurants r limit 1;
      update public.restaurants r
      set owner_user_id = uid, owner_email = jwt_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is not null then
    return query select * from public.restaurants r where r.id = found_id;
  end if;
end;
$$;

revoke all on function public.vyntex_my_restaurant() from public;
grant execute on function public.vyntex_my_restaurant() to authenticated;
grant execute on function public.vyntex_my_restaurant() to anon;

-- ── B) RLS: lexim / përditësim për pronarin (JWT email + uid + metadata id) ──

alter table if exists public.restaurants enable row level security;

drop policy if exists "vyntex_restaurants_select_self" on public.restaurants;
create policy "vyntex_restaurants_select_self"
  on public.restaurants
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      length(trim(coalesce(owner_email, ''))) > 0
      and lower(trim(owner_email)) = lower(trim(coalesce(
        (select auth.jwt() ->> 'email'),
        (select auth.jwt() -> 'user_metadata' ->> 'email'),
        ''
      )))
    )
    or (
      length(trim(coalesce(
        (select auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id'),
        ''
      ))) >= 32
      and id = (
        trim(coalesce(
          (select auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id'),
          ''
        ))::uuid
      )
    )
  );

drop policy if exists "vyntex_restaurants_update_self" on public.restaurants;
create policy "vyntex_restaurants_update_self"
  on public.restaurants
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      length(trim(coalesce(owner_email, ''))) > 0
      and lower(trim(owner_email)) = lower(trim(coalesce(
        (select auth.jwt() ->> 'email'),
        (select auth.jwt() -> 'user_metadata' ->> 'email'),
        ''
      )))
    )
    or (
      length(trim(coalesce(
        (select auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id'),
        ''
      ))) >= 32
      and id = (
        trim(coalesce(
          (select auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id'),
          ''
        ))::uuid
      )
    )
  )
  with check (owner_user_id = (select auth.uid()));

notify pgrst, 'reload schema';
