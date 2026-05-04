-- Fix POS / dashboard "Failed to save settings" when owner_user_id is null but
-- the row matches JWT email or vyntex_restaurant_id (WITH CHECK must mirror USING).

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
  with check (
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

notify pgrst, 'reload schema';
