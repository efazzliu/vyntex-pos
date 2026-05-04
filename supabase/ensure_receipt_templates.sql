-- =============================================================================
-- Fix: "Could not find the table 'public.receipt_templates' in the schema cache"
-- Prerequisite: public.pos_printers must exist (FK on printer_id). If not, run
-- ensure_pos_printers.sql first.
-- Supabase Dashboard → SQL Editor → Run (requires public.restaurants).
-- Idempotent: safe to run more than once.
-- =============================================================================

create table if not exists public.receipt_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  template_type text not null,
  toggles jsonb not null default '{}',
  labels jsonb not null default '{}',
  styles jsonb,
  printer_id uuid references public.pos_printers(id),
  created_at timestamptz not null default now(),
  unique (restaurant_id, template_type)
);

create index if not exists idx_receipt_templates_restaurant on public.receipt_templates(restaurant_id);

alter table public.receipt_templates enable row level security;

drop policy if exists "pos_dev_receipt_templates" on public.receipt_templates;
create policy "pos_dev_receipt_templates" on public.receipt_templates
  for all using (true) with check (true);

notify pgrst, 'reload schema';
