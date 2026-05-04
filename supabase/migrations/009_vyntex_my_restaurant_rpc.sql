-- Gjen restorantin për përdoruesin e kyçur (auth.uid + email nga JWT / auth.users), anashkalon RLS,
-- dhe lidh owner_user_id kur mungon ose kur email përputhet (për app-in e telefonit / POS me llogari).
-- Supabase → SQL Editor → Run once (ose përmes migrimit).

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
  total int;
  unclaimed int;
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
    select lower(trim(coalesce(u.email::text, ''))) into jwt_email
    from auth.users u
    where u.id = uid;
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

notify pgrst, 'reload schema';
