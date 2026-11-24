# RuffNeck Exchange v2.3.0 — Supplier listing photo galleries

## Supplier portal
- Suppliers can add up to four additional photographs to each listing, alongside the existing cover photo.
- Suppliers can review and remove their own additional photos from the private catalogue dashboard.
- Each additional photo is limited to 4 MB and must be a genuine JPEG, PNG or WebP file, verified by its file signature.
- Gallery edits are available only while a listing is pending, rejected or paused. Approved listings must first be paused and remain hidden from public marketplace results until RNX reviews and approves them again.

## Public marketplace and moderation
- Approved listing detail pages display an interactive photo gallery with selectable thumbnails.
- Marketplace cards retain the existing cover-photo behavior, keeping search results light.
- RNX's private moderation queue can preview the cover photo and the additional gallery photographs before deciding on a pending listing.
- Public pages receive time-limited signed URLs only for approved listings from approved suppliers. The Storage bucket remains private.

## Security and data
- Adds migration `016_rnx_listing_gallery.sql` creating the `rnx_listing_gallery_images` table with row-level security enabled and browser-role privileges revoked.
- Database triggers validate supplier ownership and listing moderation state for both uploads and deletions, and enforce the four-additional-photo cap while locking the parent listing row to serialize concurrent inserts.
- Upload and deletion endpoints require same-origin requests and authenticated supplier sessions; all database reads and writes are scoped to the owning supplier and listing.
- Failed multi-file uploads clean up any objects already uploaded. Gallery photo actions are recorded in the existing RNX audit log on a best-effort basis.
- No new environment variables, external image services or payment integrations are required. The existing private `rnx-listing-images` Storage bucket is reused.

## Deployment requirement
Apply Supabase migration 016 to the existing RuffNeck Entertainment project after confirming migrations 001–015 are already applied. Do not rerun previous migrations.
