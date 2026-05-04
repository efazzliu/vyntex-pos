-- =============================================================================
-- Z-reports (mbyllja ditore / historia Z) — ruajtje e payload-it të raportit.
-- Ekzekutoje nëse Supabase kthen: "Could not find the table 'public.pos_z_reports' in the schema cache"
-- ose nëse nuk ke aplikuar migrations/002_pos_from_convex.sql të plotë.
-- Kërkon public.restaurants.
-- Supabase Dashboard → SQL Editor → Run.
-- =============================================================================

create table if not exists public.pos_z_reports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  z_number int not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_z_reports_restaurant
  on public.pos_z_reports (restaurant_id);

create index if not exists idx_pos_z_reports_created
  on public.pos_z_reports (created_at desc);

alter table public.pos_z_reports enable row level security;

drop policy if exists "pos_dev_pos_z_reports" on public.pos_z_reports;
create policy "pos_dev_pos_z_reports" on public.pos_z_reports
  for all using (true) with check (true);

-- Rifresko cache-in e PostgREST (përndryshe API mund të mos “shohë” tabelën menjëherë).
notify pgrst, 'reload schema';
