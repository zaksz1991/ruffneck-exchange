# RuffNeck Exchange v2.4.0 — Supplier Availability Management

## What changed
- Suppliers can report each approved listing as available, limited, available on request, or currently unavailable.
- Suppliers can attach a short availability note (up to 240 characters) and update the status without taking the public listing offline or sending its catalogue content back through moderation.
- Public marketplace cards and listing details display the supplier-reported status and the timestamp of the latest supplier update.
- Marketplace search can filter by supplier-reported availability.
- Existing listings default to “Availability not confirmed”; the migration does not invent stock status for existing suppliers.

## Controls
- Availability updates require the same-origin request check and an authenticated supplier session.
- The update is scoped to the signed-in supplier and an approved listing; updates cannot change listing ownership or moderation status.
- Status values and note length are constrained in both the API and database.
- Availability is explicitly described as supplier-reported and not independently verified by RNX.
- Audit logging is best-effort and does not undo a successful listing update.

## Database
- New additive migration: `017_rnx_listing_availability.sql`.
- Apply after migrations 001–016 are already present in the existing RuffNeck Entertainment Supabase project.
- No new environment variables, Storage buckets or external services.

## Validation
- Added static regression test for migration constraints, supplier authentication/ownership checks, public rendering and marketplace filtering.
- Full TypeScript typecheck, Next.js production build, live migration execution and live supplier update have not been run in this build environment; confirm them through the Vercel deployment and the existing Supabase project.
