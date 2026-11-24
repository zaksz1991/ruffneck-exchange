# v2.9.0 build and validation status

- Source base: complete cumulative RNX v2.8.0 project archive supplied in this conversation.
- Version: 2.9.0.
- New database migration: `021_rnx_customer_request_activity_timeline.sql`.
- New regression test: `scripts/test-rnx-v290-customer-request-timeline.mjs`.
- Feature: account-linked customer request progress timeline.
- Migration 021 does not reference `rnx_listings.availability_status`, saved-listing tables or migrations 017–020.
- Included recovery script: `supabase/repairs/repair_rnx_listing_availability_prerequisite.sql` for the previously reported missing availability-column prerequisite affecting migrations 019/020.

Validation performed:
- All 18 cumulative static regression scripts: passed.
- v2.9.0 request timeline regression checks: passed.
- TypeScript syntax transpilation for both changed `.tsx`/`.ts` files: passed.
- Dependency installation: timed out in this environment.
- Full TypeScript semantic typecheck: not verified because required packages and type declarations (`next`, React, Node and Supabase packages) could not be installed. A `tsc --noEmit` attempt reported missing dependency/type declarations across the source project.
- Next.js production build: not run because dependencies could not be installed.
- Live Supabase migration and trigger behaviour: not verified in the user's project.
- Live Vercel deployment: not verified.

Do not interpret static regression or syntax-transpilation checks as proof of a successful production build or live database deployment.
