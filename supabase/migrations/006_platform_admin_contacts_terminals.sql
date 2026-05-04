-- Platform admin: client ownership, multi-terminal slots, contact inbox (Supabase).
-- Run in SQL Editor after prior migrations.

alter table public.restaurants
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table public.restaurants
  add column if not exists owner_email text;
alter table public.restaurants
  add column if not exists owner_name text;
alter table public.restaurants
  add column if not exists max_terminals int not null default 1;
alter table public.restaurants
  add column if not exists registered_devices jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_max_terminals_positive'
  ) then
    alter table public.restaurants
      add constraint restaurants_max_terminals_positive check (max_terminals >= 1);
  end if;
end $$;

-- Backfill: single bound device -> registered_devices array
update public.restaurants
set registered_devices = to_jsonb(array[device_id]::text[])
where device_id is not null
  and registered_devices = '[]'::jsonb;

-- ── Contact form (replaces Convex contactSubmissions / contactReplies) ─────

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  type text not null default 'form' check (type in ('form', 'chat')),
  status text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_submissions_email on public.contact_submissions (email);
create index if not exists idx_contact_submissions_status on public.contact_submissions (status);
create index if not exists idx_contact_submissions_created on public.contact_submissions (created_at desc);

create table if not exists public.contact_replies (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  admin_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_replies_email on public.contact_replies (email);

alter table public.contact_submissions enable row level security;
alter table public.contact_replies enable row level security;

drop policy if exists "contact_submissions_all" on public.contact_submissions;
create policy "contact_submissions_all" on public.contact_submissions
  for all using (true) with check (true);

drop policy if exists "contact_replies_all" on public.contact_replies;
create policy "contact_replies_all" on public.contact_replies
  for all using (true) with check (true);
