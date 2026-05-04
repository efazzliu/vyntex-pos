-- Hapi 1/2: Supabase SQL Editor - Ctrl+A, Run (i gjithë skripti një herë).
-- Pa DO/EXECUTE dhe pa SELECT ... INTO (shmang gabimet "relation ... does not exist" në editor).
-- Pastaj: sql_supabase_editor_02_restaurants_rls.sql

create or replace function public.vyntex_my_restaurant()
returns setof public.restaurants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p_norm_email text;
  found_id uuid;
  meta_text text;
  meta_lic text;
  lic_norm text;
  total int;
  unclaimed int;
begin
  if uid is null then
    return;
  end if;

  if coalesce((auth.jwt() -> 'user_metadata' ->> 'vyntex_phone_manager')::boolean, false) then
    meta_text := trim(coalesce((auth.jwt() -> 'user_metadata' ->> 'vyntex_restaurant_id'), ''));
    if length(meta_text) >= 32 then
      begin
        found_id := meta_text::uuid;
      exception when invalid_text_representation then
        found_id := null;
      end;
      if found_id is not null
         and (select count(*)::int from public.restaurants r where r.id = found_id) > 0 then
        return query
        select * from public.restaurants r where r.id = found_id;
      end if;
    end if;
    return;
  end if;

  p_norm_email := lower(trim(coalesce(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata') ->> 'email',
    ''
  )));

  if p_norm_email = '' then
    begin
      p_norm_email := (
        select lower(trim(coalesce(u.email::text, '')))
        from auth.users u
        where u.id = uid
      );
    exception when others then
      p_norm_email := '';
    end;
  end if;

  found_id := (
    select r.id
    from public.restaurants r
    where r.owner_user_id = uid
    order by r.created_at asc
    limit 1
  );

  if found_id is null then
    meta_text := (auth.jwt() -> 'user_metadata') ->> 'vyntex_restaurant_id';
    if meta_text is not null and btrim(meta_text) <> '' then
      begin
        found_id := btrim(meta_text)::uuid;
      exception when invalid_text_representation then
        found_id := null;
      end;
      if found_id is not null
         and (select count(*)::int from public.restaurants r where r.id = found_id) = 0 then
        found_id := null;
      end if;
      if found_id is not null then
        update public.restaurants r
        set
          owner_user_id = uid,
          owner_email = case
            when p_norm_email <> '' then p_norm_email
            else coalesce(r.owner_email, p_norm_email)
          end
        where r.id = found_id;
      end if;
    end if;
  end if;

  if found_id is null then
    meta_lic := trim(coalesce((auth.jwt() -> 'user_metadata' ->> 'vyntex_license_key'), ''));
    if length(meta_lic) >= 8 then
      lic_norm := upper(regexp_replace(meta_lic, '[^a-zA-Z0-9]', '', 'g'));
      found_id := (
        select r.id
        from public.restaurants r
        where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = lic_norm
        order by r.created_at asc
        limit 1
      );

      if found_id is not null then
        if coalesce((
          select
            (r.owner_user_id = uid)
            or (p_norm_email <> '' and lower(trim(coalesce(r.owner_email, ''))) = p_norm_email)
            or (
              r.owner_user_id is null
              and nullif(trim(coalesce(r.owner_email, '')), '') is null
            )
          from public.restaurants r
          where r.id = found_id
        ), false) then
          update public.restaurants r
          set
            owner_user_id = uid,
            owner_email = case
              when p_norm_email <> '' then p_norm_email
              else coalesce(r.owner_email, p_norm_email)
            end
          where r.id = found_id;
        else
          found_id := null;
        end if;
      end if;
    end if;
  end if;

  if found_id is null and p_norm_email <> '' then
    found_id := (
      select r.id
      from public.restaurants r
      where lower(trim(coalesce(r.owner_email, ''))) = p_norm_email
      order by r.created_at asc
      limit 1
    );

    if found_id is not null then
      update public.restaurants r
      set
        owner_user_id = uid,
        owner_email = p_norm_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is null and p_norm_email <> '' then
    total := (select count(*)::int from public.restaurants);
    unclaimed := (select count(*)::int from public.restaurants where owner_user_id is null);
    if total = 1 and unclaimed = 1 then
      found_id := (select r.id from public.restaurants r limit 1);
      update public.restaurants r
      set owner_user_id = uid, owner_email = p_norm_email
      where r.id = found_id;
    end if;
  end if;

  if found_id is not null then
    return query
    select * from public.restaurants r where r.id = found_id;
  end if;
end;
$$;

revoke all on function public.vyntex_my_restaurant() from public;
grant execute on function public.vyntex_my_restaurant() to authenticated;
grant execute on function public.vyntex_my_restaurant() to anon;
