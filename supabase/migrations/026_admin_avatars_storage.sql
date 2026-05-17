-- Public avatars for platform admin profiles (path: {user_id}/avatar.*)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-avatars',
  'admin-avatars',
  true,
  524288,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_avatars_public_read" on storage.objects;
create policy "admin_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'admin-avatars');

drop policy if exists "admin_avatars_owner_upload" on storage.objects;
create policy "admin_avatars_owner_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin_avatars_owner_update" on storage.objects;
create policy "admin_avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin_avatars_owner_delete" on storage.objects;
create policy "admin_avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
