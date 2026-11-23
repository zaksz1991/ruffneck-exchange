# RuffNeck Exchange v2.0.0 — build and validation status

## Implemented
- Listing detail pages route customers into a free enquiry with the selected listing slug.
- Request page resolves and displays only currently approved listings and approved suppliers.
- Request form preselects product/service/wholesale request type, category and supported state, with an editable offer-specific brief.
- Lead API revalidates listing/supplier approval and stores server-derived listing ID plus title/slug/supplier snapshots.
- Admin lead queue, optional email notifications and private tracking display the referenced offer.
- Migration 014 adds a nullable listing foreign key, historical snapshots and lookup index without changing earlier lead records or browser-role permissions.
- Historical package-version assertions were updated to validate the current release rather than stale version strings.

## Checks completed
- `scripts/test-account-recovery.mjs` — passed.
- `scripts/test-email-verification.mjs` — passed.
- `scripts/test-supplier-form-build-fix.mjs` — passed.
- `scripts/test-supplier-listing-controls.mjs` — passed.
- `scripts/test-rnx-v180-operations-upgrade.mjs` — passed (20 assertions).
- `scripts/test-rnx-v190-marketplace-search.mjs` — passed (32 assertions).
- `scripts/test-rnx-v200-listing-enquiry.mjs` — passed.
- TypeScript syntax transpilation — passed for the eight changed TS/TSX files.

## Checks not completed
- Full `tsc --noEmit` semantic typecheck — not completed.
- `next build` production build — not completed.
- Dependency installation was attempted but npm could not resolve `registry.npmjs.org` (`EAI_AGAIN`); the upload did not include `node_modules` or a lockfile.
- Live Supabase migration execution, production database behaviour and deployed Vercel behaviour are not established by local static tests.

## Database and environment
- Required migration: `014_rnx_listing_enquiry_context.sql`, after migrations 001–013.
- No new environment variable.
- No external provider, payment gateway or non-RNX table modification.
