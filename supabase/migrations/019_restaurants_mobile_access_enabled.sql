alter table if exists public.restaurants
add column if not exists mobile_access_enabled boolean not null default true;
