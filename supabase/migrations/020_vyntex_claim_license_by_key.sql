-- Link an unassigned (claimable) license row to the signed-in Supabase user.
-- Used from the web dashboard when the POS was activated without a browser session.
-- Run via `supabase db push` / migrations, or paste into SQL Editor.

create or replace function public.vyntex_claim_license_by_key(p_license text)
returns setof public.restaurants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  jwt_email text;
  jwt_name text;
  rid uuid;
  norm_key text;
  match_count int;
  updated_rows int;
begin
  if uid is null then
    raise exception 'You must be signed in to link a license.';
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

  jwt_name := trim(coalesce(
    (auth.jwt() -> 'user_metadata') ->> 'full_name',
    ''
  ));

  norm_key := upper(regexp_replace(coalesce(p_license, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm_key) < 16 then
    raise exception 'Enter a valid 16-character license key.';
  end if;

  select count(*)::int into match_count
  from public.restaurants r
  where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = norm_key;

  if match_count = 0 then
    raise exception 'License not found.';
  end if;
  if match_count > 1 then
    raise exception 'Multiple venues share this key; contact support.';
  end if;

  select r.id into rid
  from public.restaurants r
  where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g')) = norm_key
  limit 1;

  if exists (select 1 from public.restaurants r where r.id = rid and r.owner_user_id = uid) then
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  if jwt_email <> '' and exists (
    select 1 from public.restaurants r
    where r.id = rid
      and r.owner_user_id is null
      and lower(trim(coalesce(r.owner_email, ''))) = jwt_email
  ) then
    update public.restaurants r
    set
      owner_user_id = uid,
      owner_email = jwt_email,
      owner_name = case when jwt_name <> '' then jwt_name else r.owner_name end
    where r.id = rid;
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  if exists (
    select 1 from public.restaurants r
    where r.id = rid
      and r.owner_user_id is null
      and (r.owner_email is null or length(trim(coalesce(r.owner_email, ''))) = 0)
  ) then
    update public.restaurants r
    set
      owner_user_id = uid,
      owner_email = case when jwt_email <> '' then jwt_email else r.owner_email end,
      owner_name = case when jwt_name <> '' then jwt_name else r.owner_name end,
      name = case
        when lower(trim(coalesce(r.name, ''))) = 'unassigned license' and jwt_name <> '' then jwt_name
        when lower(trim(coalesce(r.name, ''))) = 'unassigned license' then split_part(coalesce(jwt_email, 'user'), '@', 1)
        else r.name
      end
    where r.id = rid;
    get diagnostics updated_rows = ROW_COUNT;
    if updated_rows = 0 then
      raise exception 'Could not link this license; try again or contact support.';
    end if;
    return query select * from public.restaurants r where r.id = rid;
    return;
  end if;

  raise exception 'This license is already linked to another account.';
end;
$$;

revoke all on function public.vyntex_claim_license_by_key(text) from public;
grant execute on function public.vyntex_claim_license_by_key(text) to authenticated;

notify pgrst, 'reload schema';
