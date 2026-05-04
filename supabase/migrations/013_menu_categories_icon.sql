-- Emoji / glyph for POS category chips (order screen). Safe to re-run.
alter table public.menu_categories
  add column if not exists icon text;
