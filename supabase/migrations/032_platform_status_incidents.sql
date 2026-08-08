-- Real incident history for the customer-facing System Status page.

create table if not exists public.platform_status_incidents (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  title text not null,
  details text,
  status text not null check (status in ('investigating', 'identified', 'monitoring', 'resolved', 'completed')),
  started_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_status_incidents_started
  on public.platform_status_incidents (started_at desc);

alter table public.platform_status_incidents enable row level security;

drop policy if exists "status_incidents_authenticated_read" on public.platform_status_incidents;
create policy "status_incidents_authenticated_read"
  on public.platform_status_incidents
  for select
  to authenticated
  using (true);

drop policy if exists "status_incidents_platform_admin_manage" on public.platform_status_incidents;
create policy "status_incidents_platform_admin_manage"
  on public.platform_status_incidents
  for all
  to authenticated
  using (public.vyntex_is_platform_admin())
  with check (public.vyntex_is_platform_admin());

grant select on public.platform_status_incidents to authenticated;
grant insert, update, delete on public.platform_status_incidents to authenticated;

notify pgrst, 'reload schema';
