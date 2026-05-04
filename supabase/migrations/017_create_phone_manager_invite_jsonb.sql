-- Reliable JSON response for create_phone_manager_invite (PostgREST + supabase-js).
-- Run after 015_phone_manager_invites.sql. Replaces TABLE return with jsonb + retry on code collision.
--
-- Avoid jsonb_build_object('ok', ...) alone: if smart quotes corrupt SQL, "ok" is parsed as a table (42P01).
-- Static errors use '{"ok":false,...}'::jsonb; success merges '{"ok":true}'::jsonb with dynamic fields.
--
-- 015 defined RETURNS TABLE (...); 017 uses RETURNS jsonb. Postgres cannot change return type with CREATE OR REPLACE (42P13).
drop function if exists public.create_phone_manager_invite(uuid);

create or replace function public.create_phone_manager_invite(p_restaurant_id uuid)
returns jsonb
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
  attempts int := 0;
begin
  if uid is null then
    return '{"ok":false,"error":"not_authenticated"}'::jsonb;
  end if;

  -- Use := not SELECT INTO (plain SQL treats INTO name as a table target in some clients).
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

  loop
    attempts := attempts + 1;
    if attempts > 25 then
      return '{"ok":false,"error":"code_generation_failed"}'::jsonb;
    end if;

    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;

    begin
      insert into public.phone_manager_invites (restaurant_id, code, created_by, expires_at)
      values (p_restaurant_id, new_code, uid, exp);
      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return (jsonb_build_object('code', new_code, 'expires_at', exp) || '{"ok":true}'::jsonb);
end;
$$;

revoke all on function public.create_phone_manager_invite(uuid) from public;
grant execute on function public.create_phone_manager_invite(uuid) to authenticated;

notify pgrst, 'reload schema';
