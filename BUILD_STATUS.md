# RuffNeck Exchange v2.2.0 — build and validation status

## Implemented
- Supplier catalogue supports one cover image per listing.
- Uploads accept JPEG, PNG and WebP, maximum 4 MB, with server-side file-signature validation.
- Image changes require supplier authentication, same-origin requests, ownership checks and pending/rejected/paused listing status. Approved listings must first be paused.
- Images are stored in a private Supabase Storage bucket; public marketplace pages receive short-lived signed URLs only for offers that pass the existing supplier/listing approval query.
- Supplier portal previews images and displays listing thumbnails. RNX staff can preview submitted images in the pending catalogue review queue. Public listing cards and details display the approved cover image or a branded fallback.
- Replaced image objects are removed after the database update succeeds; upload events enter the existing RNX audit log.

## Validation
- Static regression test `test:rnx-v220` checks migration, private storage, type/size constraints, file-signature checks, ownership, moderation guards, signed URLs and UI integration.
- Earlier regression tests remain part of the cumulative `check` script.
- Full TypeScript semantic checking and Next.js production build have not been completed in this packaging environment. Live Supabase Storage and Vercel behaviour are not established by static tests.

## Deployment
- Replace the complete repository with this cumulative v2.2.0 source archive.
- Confirm migrations 001–014 are already applied, then apply only migration 015.
- No new environment variable is required. The private `rnx-listing-images` bucket is created and configured by the server-side upload helper on first use.
