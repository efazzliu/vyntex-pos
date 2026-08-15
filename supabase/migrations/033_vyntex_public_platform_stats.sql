-- Public, anonymous-safe aggregate stats for the marketing landing page.
-- Returns counts only (never row data) so it is safe to grant to `anon`.

create or replace function public.vyntex_public_platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restaurants', (
      select count(*)::int from public.restaurants
    ),
    'paid_orders', (
      select count(*)::int from public.sales where status = 'paid'
    ),
    'countries', (
      select count(distinct trim(country))::int
      from public.restaurants
      where trim(coalesce(country, '')) <> ''
    )
  );
$$;

revoke all on function public.vyntex_public_platform_stats() from public;
grant execute on function public.vyntex_public_platform_stats() to anon, authenticated;

notify pgrst, 'reload schema';
