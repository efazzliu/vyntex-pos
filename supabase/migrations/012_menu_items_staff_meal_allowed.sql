-- menu-ops.createItem / updateItem përdorin staff_meal_allowed; kolona duhet të ekzistojë.
alter table public.menu_items
  add column if not exists staff_meal_allowed boolean not null default true;

notify pgrst, 'reload schema';
