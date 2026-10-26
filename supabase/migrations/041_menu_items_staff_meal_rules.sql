-- Per-item staff meal price, free quota, and daily quantity limit.
alter table public.menu_items
  add column if not exists staff_meal_price numeric(12, 2);

alter table public.menu_items
  add column if not exists staff_meal_free_qty int;

alter table public.menu_items
  add column if not exists staff_meal_daily_limit int;

alter table public.menu_items
  alter column staff_meal_allowed set default false;

notify pgrst, 'reload schema';
