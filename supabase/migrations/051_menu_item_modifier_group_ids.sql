-- Product ↔ modifier library assignment (Settings → Modifiers groups).
-- Reuses existing menu_items; no parallel order/modifier tables.
alter table public.menu_items
  add column if not exists modifier_group_ids jsonb not null default '[]'::jsonb;
