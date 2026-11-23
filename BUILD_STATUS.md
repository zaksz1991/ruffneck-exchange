# RuffNeck Exchange v2.1.0 — build and validation status

## Implemented
- Supplier portal now loads the full editable catalogue fields for the authenticated supplier.
- Suppliers can edit pending, rejected and paused listings without creating duplicate catalogue records.
- Approved listings must be paused before editing; edits return the listing to `pending` for RNX moderation.
- Rejected listings can be corrected and resubmitted; paused listings can also be resubmitted unchanged.
- Server-side updates validate all fields, scope the record to the authenticated supplier, preserve the slug, guard against concurrent status changes and write supplier-action audit records.
- No database migration or environment-variable change is required.

## Validation
- Static regression tests cover supplier ownership, same-origin protection, status gating, field validation, price consistency, stale update protection and the supplier edit UI.
- Full TypeScript semantic check and Next.js production build have not been run in this packaging environment because dependencies are not installed. They must be completed by the deployment environment.
- Live Supabase and Vercel behaviour is not established by static tests.

## Deployment
- Replace the complete repository with this cumulative v2.1.0 source archive.
- No Supabase SQL migration is required for v2.1.0. Keep previously applied migrations 001–014; do not rerun them.
