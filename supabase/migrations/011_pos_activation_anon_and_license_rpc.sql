-- Aktivizim licencë me ANON: policy për anon + RPC kërkimi normalizuar të license_key.
-- Shih edhe supabase/ensure_pos_restaurants_anon_for_activation.sql

drop policy if exists "pos_anon_restaurants_activation" on public.restaurants;
create policy "pos_anon_restaurants_activation"
  on public.restaurants
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "pos_dev_restaurants_all" on public.restaurants;
create policy "pos_dev_restaurants_all"
  on public.restaurants
  for all
  using (true)
  with check (true);

create or replace function public.vyntex_restaurant_for_activation(p_license text)
returns setof public.restaurants
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.restaurants r
  where upper(regexp_replace(coalesce(r.license_key, ''), '[^a-zA-Z0-9]', '', 'g'))
    = upper(regexp_replace(coalesce(p_license, ''), '[^a-zA-Z0-9]', '', 'g'))
  limit 2;
$$;

revoke all on function public.vyntex_restaurant_for_activation(text) from public;
grant execute on function public.vyntex_restaurant_for_activation(text) to anon;
grant execute on function public.vyntex_restaurant_for_activation(text) to authenticated;

notify pgrst, 'reload schema';
