# RuffNeck Exchange v2.2.0 — supplier listing cover images

## Supplier catalogue
- Suppliers can upload one cover image when creating or editing a listing.
- Accepted formats are JPEG, PNG and WebP, capped at 4 MB.
- The server checks the file signature rather than trusting the browser-supplied MIME type or file extension.
- Suppliers can replace the cover image on pending, rejected and paused listings. Approved listings must first be paused, consistent with the existing moderation workflow.
- The supplier portal shows the current image and a thumbnail for each listing. RNX staff can inspect the submitted image in the pending catalogue review queue before making an approval decision.

## Marketplace presentation
- Approved public listing cards and offer-detail pages show the supplier-submitted cover image.
- Listings without an image retain a branded category placeholder.
- Images remain in a private Supabase Storage bucket. Public pages receive one-hour signed URLs only after the existing approved-listing and approved-supplier checks pass.
- Superseded storage objects are removed after the listing record is successfully updated.

## Security and database
- Adds migration 015 with nullable `rnx_listings.image_path` and a restrictive Storage policy blocking browser-role access to `rnx-listing-images`.
- The bucket is created and maintained by a server-only helper as private, with a 4 MB limit and JPEG/PNG/WebP allow-list.
- Uploads require a valid supplier session, same-origin request, listing ownership and an editable moderation state. The status is checked again during the database update to reject concurrent moderation changes.
- Image uploads are recorded in the existing RNX administrative audit log.
- No new environment variable or external provider is required.

## Deployment
Apply only `supabase/migrations/015_rnx_listing_images.sql` after confirming RNX migrations 001–014 are already applied. Do not rerun completed migrations.
