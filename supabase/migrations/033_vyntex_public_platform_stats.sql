-- Public, anonymous-safe aggregate stats for the marketing landing page.
-- Returns counts only (never row data) so it is safe to grant to `anon`.
-- Defensive against schema drift: each aggregate is wrapped so a missing
-- table/column degrades that one stat to 0 instead of failing the call.

create or replace function public.vyntex_public_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurants int := 0;
  v_paid_orders int := 0;
  v_countries int := 0;
begin
  begin
    select count(*)::int into v_restaurants from public.restaurants;
  exception when others then
    v_restaurants := 0;
  end;

  begin
    select count(*)::int into v_paid_orders from public.sales where status = 'paid';
  exception when others then
    v_paid_orders := 0;
  end;

  begin
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'restaurants'
        and column_name = 'country'
    ) then
      execute
        'select count(distinct trim(country))::int
         from public.restaurants
         where trim(coalesce(country, '''')) <> '''''
        into v_countries;
    else
      v_countries := 0;
    end if;
  exception when others then
    v_countries := 0;
  end;

  return jsonb_build_object(
    'restaurants', v_restaurants,
    'paid_orders', v_paid_orders,
    'countries', v_countries
  );
end;
$$;

revoke all on function public.vyntex_public_platform_stats() from public;
grant execute on function public.vyntex_public_platform_stats() to anon, authenticated;

notify pgrst, 'reload schema';
