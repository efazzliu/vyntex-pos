-- =============================================================================
-- Fix: "Could not find the table 'public.pos_printers' in the schema cache"
-- Supabase Dashboard → SQL Editor → Run (requires public.restaurants).
-- Idempotent: safe to run more than once.
-- =============================================================================

create table if not exists public.pos_printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bluetooth', 'network', 'usb')),
  address text not null default '',
  role text not null check (role in ('receipt', 'kitchen', 'bar')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_printers_restaurant on public.pos_printers(restaurant_id);

alter table public.pos_printers enable row level security;

drop policy if exists "pos_dev_pos_printers" on public.pos_printers;
create policy "pos_dev_pos_printers" on public.pos_printers
  for all using (true) with check (true);

notify pgrst, 'reload schema';
