-- Edit Product → Advanced: SKU, barcode and internal notes on menu items.
-- Run once in Supabase → SQL Editor.

alter table public.menu_items add column if not exists sku text;
alter table public.menu_items add column if not exists barcode text;
alter table public.menu_items add column if not exists internal_notes text;

-- One SKU / barcode per venue (empty values are stored as null and are not checked).
create unique index if not exists menu_items_restaurant_sku_key
  on public.menu_items (restaurant_id, lower(sku))
  where sku is not null;
create unique index if not exists menu_items_restaurant_barcode_key
  on public.menu_items (restaurant_id, barcode)
  where barcode is not null;

notify pgrst, 'reload schema';
