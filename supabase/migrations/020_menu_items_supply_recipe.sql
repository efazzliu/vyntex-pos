-- Optional BOM per sellable menu row: JSON array of
-- { "supplyMenuItemId": "<uuid>", "qtyPerUnit": <number> } (per 1 sold unit of this item).
alter table public.menu_items
  add column if not exists supply_recipe jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
