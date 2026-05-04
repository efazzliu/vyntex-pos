-- Hapi 2/2: ekzekuto PAS sql_supabase_editor_01_vyntex_my_restaurant_fn.sql (Ctrl+A → Run).

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
