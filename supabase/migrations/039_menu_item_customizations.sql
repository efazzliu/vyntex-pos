-- Per-item customization options (admin-defined) and selected choices on order lines.
alter table public.menu_items
  add column if not exists customization_config jsonb not null default '[]'::jsonb;

alter table public.sale_items
  add column if not exists selected_customizations jsonb not null default '[]'::jsonb;
