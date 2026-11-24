# RuffNeck Exchange v2.3.0 — build and validation status

## Included functionality
- Complete cumulative RNX application retained through v2.2.2.
- Suppliers can add and remove up to four additional listing photos alongside the existing cover image.
- Gallery photos use the existing private Supabase Storage bucket. Uploads accept genuine JPEG, PNG and WebP files up to 4 MB each.
- The private supplier dashboard manages extra photos. Listing approval state controls when photos can be changed.
- Approved public listing detail pages show an interactive photo gallery. Marketplace cards continue to use the single cover image.
- RNX moderators can preview cover and gallery photos before approving a pending listing.

## Security and database
- Migration 016 adds `rnx_listing_gallery_images`, enables RLS and revokes browser-role privileges.
- Database triggers enforce supplier ownership and allowed moderation states for uploads and deletions, plus a hard maximum of four additional photos per listing while serialising concurrent inserts on the listing row.
- Upload and delete APIs require same-origin requests and the authenticated supplier session, and scope records to the supplier and listing.
- Failed batch uploads clean up already uploaded Storage objects. Audit events are best-effort and do not invalidate a completed action.
- No new Vercel environment variables or external providers.

## Validation
- Added `test-rnx-v230-listing-gallery.mjs` to check migration controls, upload/delete security, database enforcement, signed URLs, supplier portal management, public gallery rendering and admin preview integration.
- The static regression suite must be run in the project environment.
- Full TypeScript typechecking, the Next.js production build, live Supabase migration execution and live Storage upload testing have not yet been executed in this environment. Vercel and the existing Supabase project must confirm them after deployment.

## Deployment
- Apply migration 016 only after confirming RNX migrations 001–015 are present in the RuffNeck Entertainment Supabase project.
- No new environment variables. Retain the existing `SUPABASE_URL` and server-side secret configuration.
