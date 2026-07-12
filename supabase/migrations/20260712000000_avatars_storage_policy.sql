-- avatars bucket created via Storage API (public read). Restrict writes to
-- a path prefixed with the uploader's own user id: avatars/<user_id>/<file>.
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_select_public" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
