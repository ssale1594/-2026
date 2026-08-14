-- Storage bucket for listing photos (TECH.md §4): public bucket, client-side
-- compression/WebP happens before upload, the DB only ever stores the path.
--
-- Path convention: {seller_id}/{listing_id}/{filename} — this lets the RLS
-- policies below check ownership straight from the object path, no joins needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "listing_images_public_read" on storage.objects;
create policy "listing_images_public_read" on storage.objects
  for select using (bucket_id = 'listing-images');

drop policy if exists "listing_images_owner_insert" on storage.objects;
create policy "listing_images_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'listing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "listing_images_owner_delete" on storage.objects;
create policy "listing_images_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'listing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
