-- =============================================================================
-- Audit log (POS "Regjistri i auditimit") — same shape as migrations/002.
-- Run if the audit screen is always empty or Supabase errors mention pos_audit_logs.
-- Requires public.restaurants and public.staff (optional FK on staff_id).
-- Supabase Dashboard → SQL Editor → Run.
-- =============================================================================

create table if not exists public.pos_audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id uuid references public.staff(id),
  staff_name text not null,
  action text not null,
  details text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_audit_logs_restaurant_created
  on public.pos_audit_logs (restaurant_id, created_at desc);

alter table public.pos_audit_logs enable row level security;

drop policy if exists "pos_dev_pos_audit_logs" on public.pos_audit_logs;
create policy "pos_dev_pos_audit_logs" on public.pos_audit_logs
  for all using (true) with check (true);

notify pgrst, 'reload schema';
