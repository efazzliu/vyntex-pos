-- Allow restricting which menu items appear in waiter "Staff meal" self-service.
-- Default true: existing rows stay visible until you turn off per item in Menu.
alter table public.menu_items
  add column if not exists staff_meal_allowed boolean not null default true;

notify pgrst, 'reload schema';
