-- Paddle subscription payments (webhook → admin revenue KPIs).
-- Apply in Supabase SQL Editor, then deploy: supabase functions deploy paddle-webhook --no-verify-jwt

create table if not exists public.platform_billing_transactions (
  id uuid primary key default gen_random_uuid(),
  paddle_event_id text not null unique,
  paddle_transaction_id text,
  paddle_subscription_id text,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  customer_email text,
  customer_name text,
  plan text check (plan in ('starter', 'professional', 'enterprise')),
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  amount_minor bigint not null,
  currency text not null default 'EUR',
  status text not null check (status in ('paid', 'pending', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_billing_paid_at
  on public.platform_billing_transactions (paid_at desc nulls last);

create index if not exists idx_platform_billing_subscription
  on public.platform_billing_transactions (paddle_subscription_id)
  where paddle_subscription_id is not null;

create index if not exists idx_platform_billing_status
  on public.platform_billing_transactions (status);

alter table public.restaurants
  add column if not exists paddle_subscription_id text;

alter table public.restaurants
  add column if not exists paddle_customer_id text;

-- Platform admins allowed to read billing KPIs (sync emails with VITE_PLATFORM_ADMIN_EMAILS).
create table if not exists public.platform_admin_emails (
  email citext primary key,
  created_at timestamptz not null default now()
);

comment on table public.platform_admin_emails is
  'Emails allowed to read platform_billing_transactions. Insert rows matching VITE_PLATFORM_ADMIN_EMAILS.';

alter table public.platform_admin_emails enable row level security;

drop policy if exists "platform_admin_emails_select_self" on public.platform_admin_emails;
create policy "platform_admin_emails_select_self" on public.platform_admin_emails
  for select
  to authenticated
  using (
    lower(email::text) = lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (auth.jwt() -> 'user_metadata') ->> 'email',
      ''
    )))
  );

create or replace function public.vyntex_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admin_emails p
    where lower(p.email::text) = lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (auth.jwt() -> 'user_metadata') ->> 'email',
      ''
    )))
  );
$$;

revoke all on function public.vyntex_is_platform_admin() from public;
grant execute on function public.vyntex_is_platform_admin() to authenticated;

alter table public.platform_billing_transactions enable row level security;

drop policy if exists "platform_billing_select_authenticated" on public.platform_billing_transactions;
drop policy if exists "platform_billing_select_platform_admin" on public.platform_billing_transactions;
create policy "platform_billing_select_platform_admin" on public.platform_billing_transactions
  for select
  to authenticated
  using (public.vyntex_is_platform_admin());

comment on table public.platform_billing_transactions is
  'Subscription charges ingested from Paddle webhooks; readable only by platform_admin_emails.';
