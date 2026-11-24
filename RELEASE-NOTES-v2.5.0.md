# RuffNeck Exchange v2.5.0 — Customer Saved Offers

## Included

- Signed-in customers can save published marketplace offers from listing detail pages.
- Customers can review and remove saved offers in their customer dashboard.
- Saved cards show the offer, supplier, location, current supplier-reported availability and the current listing image.
- Duplicate saves are idempotent.
- The API verifies customer ownership on every read and delete, and checks that the listing and supplier remain approved before saving.
- Private customer saved-offer records are protected by RLS with direct access revoked from `anon` and `authenticated` roles.
- A database trigger prevents new saved records from being created for unpublished or unapproved listings.

## Supabase

Apply `supabase/migrations/018_rnx_customer_saved_listings.sql` to the existing RuffNeck Entertainment Supabase project after migrations 001–017 are present. This migration creates only the RNX saved-listing table, index, trigger and guard function. It does not modify non-RNX tables.

No new environment variables are required.

## Changed application files

- `app/api/customer/saved-listings/route.ts`
- `app/marketplace/listing/[slug]/page.tsx`
- `app/customer/dashboard/page.tsx`
- `app/customer/login/page.tsx`
- `app/globals.css`
- `components/customer-dashboard.tsx`
- `components/save-listing-button.tsx`
- `package.json`
- `scripts/test-rnx-v250-customer-saved-listings.mjs`
- `supabase/migrations/018_rnx_customer_saved_listings.sql`
