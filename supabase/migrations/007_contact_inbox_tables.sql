-- Contact inbox (site chat + contact form). Safe to run if 006 was skipped.
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

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
