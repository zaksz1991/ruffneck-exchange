# RuffNeck Exchange v2.4.0 — build and validation status

## Included functionality
- Complete cumulative RNX application retained through v2.3.0.
- Suppliers can update availability on approved listings without pausing the listing or resubmitting catalogue content for moderation.
- Supported values: available, limited availability, confirm on request, and currently unavailable. Existing listings default to unconfirmed.
- Suppliers can add an optional 240-character availability note.
- Public listing cards, detail pages and marketplace filters expose the supplier-reported availability.

## Security and database
- Migration 017 adds the status, note and last-update timestamp to `rnx_listings`.
- Updates require same-origin requests, authenticated supplier sessions, supplier ownership and approved listing status.
- API validation and database constraints restrict allowed values and note length.
- Audit events are best-effort and do not turn successful changes into failures.
- Public copy explicitly states that availability is supplier-reported, not independently verified by RNX.
- No new Vercel environment variables, Storage buckets or external providers.

## Validation
- Added `test-rnx-v240-listing-availability.mjs` for migration controls, API authentication/ownership scoping, supplier portal controls, public rendering and search filtering.
- Full TypeScript typechecking, Next.js production build, live Supabase migration execution and live availability update have not been executed in this environment. Confirm compilation through Vercel after deployment.

## Deployment
- Apply migration 017 only after confirming RNX migrations 001–016 are already present in the RuffNeck Entertainment Supabase project.
- No new environment variables. Retain current server-side Supabase credentials.
