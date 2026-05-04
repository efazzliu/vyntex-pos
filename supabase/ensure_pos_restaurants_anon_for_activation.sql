-- POS desktop / aktivizim pa hyrje në llogari përdor Supabase ANON key.
-- Problemi: nëse ke vetëm politika "vyntex_*" për `authenticated`, `anon` nuk sheh
-- `restaurants` → UI: "Invalid license key" ose licencë nuk gjendet.
-- Problemi 2: .eq("license_key", ...) dështon nëse në DB ruhet pa viza ose me shkronja të vogla.
--
-- Ekzekuto në Supabase → SQL Editor (një herë).

-- A) Lexim + përditësim për rolin anon (pajisje / registered_devices gjatë aktivizimit)
drop policy if exists "pos_anon_restaurants_activation" on public.restaurants;
create policy "pos_anon_restaurants_activation"
  on public.restaurants
  for all
  to anon
  using (true)
  with check (true);

-- B) Mbaj edhe policy e hapur për të gjitha rolet (dev / kompatibilitet me migrimet e vjetra)
drop policy if exists "pos_dev_restaurants_all" on public.restaurants;
create policy "pos_dev_restaurants_all"
  on public.restaurants
  for all
  using (true)
  with check (true);

-- C) RPC: gjej restorant sipas licencës (normalizuar), anashkalon RLS nëse politikat mungojnë
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
