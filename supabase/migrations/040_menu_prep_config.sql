-- Kitchen/bar prep options shown on the waiter "How to prepare" screen.
-- Admin configures per item (override) or per category (default for that category).
alter table public.menu_items
  add column if not exists prep_config jsonb not null default '{}'::jsonb;

alter table public.menu_categories
  add column if not exists prep_config jsonb not null default '{}'::jsonb;
