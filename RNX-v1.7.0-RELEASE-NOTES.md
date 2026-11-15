# RuffNeck Exchange v1.7.0 — Supplier Catalogue Controls

## New supplier capability
Suppliers can now pause an approved listing from their private dashboard. A paused listing is removed from public marketplace results without deleting its catalogue record.

Suppliers can submit a paused listing for review again. Reactivation changes the status to `pending`; it does not immediately republish the offer. RNX staff must approve it again before it becomes public.

## Access and safety
- Same-origin request validation is required.
- A valid supplier session is required.
- Listing lookup and updates are scoped to the authenticated supplier's own supplier application ID.
- Only `approved` listings can be paused.
- Only `paused` listings can be resubmitted for review.
- Rejected and pending listings cannot be changed through these controls.
- No customer contact, payment, membership, supplier approval or verification state is modified.

## Database and configuration
- No new Supabase migration.
- No new environment variables.
- Uses the existing `rnx_listings` status values from migration 002 (`approved`, `paused`, `pending`).
- Existing migrations 001–013 are retained in the complete project.

## Validation
- Static supplier listing-control contract test included.
- Account recovery, email verification and supplier form regression tests retained.
- Full Next.js build and typecheck are not claimed: dependency installation did not complete in the preparation environment.
- No live Supabase, GitHub or Vercel operation was performed.
