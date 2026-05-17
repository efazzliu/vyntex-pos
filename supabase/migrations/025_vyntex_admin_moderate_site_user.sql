-- Delete or ban site users from admin UI (no Edge Function required).
-- Requires 024 (site_banned_emails). Run in Supabase SQL Editor.

create or replace function public.vyntex_admin_moderate_site_user(
  p_user_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_caller_email text;
  v_venues_deleted int := 0;
begin
  if not public.vyntex_is_platform_admin() then
    raise exception 'Not authorized to moderate site users.';
  end if;

  if p_action is null or p_action not in ('delete', 'ban') then
    raise exception 'Invalid action. Use delete or ban.';
  end if;

  v_caller_email := lower(trim(coalesce(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata') ->> 'email',
    ''
  )));

  select lower(trim(u.email::text)) into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null or v_email = '' then
    raise exception 'User not found.';
  end if;

  if v_caller_email <> '' and v_email = v_caller_email then
    raise exception 'Cannot delete or ban your own account.';
  end if;

  if exists (
    select 1
    from public.platform_admin_emails p
    where lower(p.email::text) = v_email
  ) then
    raise exception 'Cannot delete or ban a platform admin account.';
  end if;

  delete from public.restaurants r
  where r.owner_user_id = p_user_id
     or (
       length(trim(coalesce(r.owner_email, ''))) > 0
       and lower(trim(r.owner_email)) = v_email
     );
  get diagnostics v_venues_deleted = row_count;

  delete from public.contact_submissions
  where lower(trim(email)) = v_email;

  delete from public.contact_replies
  where lower(trim(email)) = v_email;

  if p_action = 'ban' then
    insert into public.site_banned_emails (email, banned_user_id, banned_by_email)
    values (v_email, p_user_id, nullif(v_caller_email, ''))
    on conflict (email) do update set
      banned_user_id = excluded.banned_user_id,
      banned_by_email = excluded.banned_by_email,
      banned_at = now();
  end if;

  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'email', v_email,
    'venues_deleted', v_venues_deleted
  );
end;
$$;

revoke all on function public.vyntex_admin_moderate_site_user(uuid, text) from public;
grant execute on function public.vyntex_admin_moderate_site_user(uuid, text) to authenticated;

notify pgrst, 'reload schema';
