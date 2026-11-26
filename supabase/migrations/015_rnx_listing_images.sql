-- RNX supplier listing cover images.
-- Additive only: does not alter unrelated RuffNeck Entertainment tables.
-- Requires the cumulative RNX catalogue through migration 014.

alter table public.rnx_listings
  add column if not exists image_path text;

comment on column public.rnx_listings.image_path is
  'Private Supabase Storage object path for the supplier-submitted listing cover image. Public pages receive short-lived signed URLs only for approved listings.';

-- Restrict browser roles from reading or writing this private bucket even if
-- another application in the shared Supabase project adds broad permissive
-- storage policies. Server-side service-role operations remain available.
drop policy if exists rnx_listing_images_block_browser_access on storage.objects;
create policy rnx_listing_images_block_browser_access
  on storage.objects as restrictive
  for all to public
  using (bucket_id <> 'rnx-listing-images')
  with check (bucket_id <> 'rnx-listing-images');
