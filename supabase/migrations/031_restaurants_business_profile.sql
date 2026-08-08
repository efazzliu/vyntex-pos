-- Editable legal, contact, regional, and tax information for the customer dashboard.

alter table public.restaurants
  add column if not exists legal_name text,
  add column if not exists business_email text,
  add column if not exists website text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists tax_number text,
  add column if not exists vat_number text,
  add column if not exists default_vat_rate numeric(5,4) not null default 0.20,
  add column if not exists timezone text not null default 'Europe/Tirane',
  add column if not exists business_profile_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_default_vat_rate_range'
      and conrelid = 'public.restaurants'::regclass
  ) then
    alter table public.restaurants
      add constraint restaurants_default_vat_rate_range
      check (default_vat_rate >= 0 and default_vat_rate <= 1);
  end if;
end $$;

comment on column public.restaurants.legal_name is
  'Registered legal business name used on fiscal documents.';
comment on column public.restaurants.vat_number is
  'VAT registration number shown on receipts and invoices.';
comment on column public.restaurants.default_vat_rate is
  'Default VAT rate as a decimal, for example 0.20 = 20%.';

notify pgrst, 'reload schema';
