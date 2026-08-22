-- Public menu item photos (path: {restaurant_id}/{menu_item_id}.{ext})
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "menu_photos_public_read" on storage.objects;
create policy "menu_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_upload" on storage.objects;
create policy "menu_photos_pos_upload"
  on storage.objects for insert
  with check (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_update" on storage.objects;
create policy "menu_photos_pos_update"
  on storage.objects for update
  using (bucket_id = 'menu-photos');

drop policy if exists "menu_photos_pos_delete" on storage.objects;
create policy "menu_photos_pos_delete"
  on storage.objects for delete
  using (bucket_id = 'menu-photos');
