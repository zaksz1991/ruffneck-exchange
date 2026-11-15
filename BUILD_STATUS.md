# Build status — RuffNeck Exchange v1.2.0

## New capability

This release adds a customer complaint and dispute workflow linked to the private request-tracking token. Customers can raise cases, optionally link the report to a supplier they were already introduced to through a completed, customer-approved offer, see customer-safe status and resolution updates, and send case-specific messages. Authorised staff can triage, set severity, assign case ownership, record internal notes, send customer-visible replies and retain an event history.

## Changes

- Added migration `010_rnx_trust_cases.sql` with RNX-only case, message and event tables and restricted service-role access.
- Added case references in the form `RNX-CASE-00000001` using an RNX sequence.
- Added customer case submission, case messaging and customer-safe case reads through the existing 256-bit request tracking token.
- Added an operations trust queue at `/admin/trust` with role-gated access, case assignment, severity, constrained status transitions, internal notes and public resolution summaries.
- Extended staff permissions: owner and operations administrator can read/write cases; customer support can read/write cases; finance and analyst cannot access case-level records.
- Added case event history and staff activity entries for administrative changes.
- Customer notifications are queued only when `RNX_OPERATIONS_NOTIFICATION_EMAIL` or the customer's email is available and the existing notification subsystem is configured; delivery remains dependent on Resend setup.
- Customer reads return only messages marked `visibility=customer`. Internal notes are not selected by the tracking endpoint.
- Existing request tracking remains available during deployment if migration 010 has not yet reached the Supabase schema cache; the case panel is temporarily disabled and directs the customer to the existing general message thread.

## Database impact

Migration 010 depends on migrations 001–009 and creates only:
- `rnx_trust_cases`
- `rnx_trust_case_messages`
- `rnx_trust_case_events`
- `rnx_trust_case_reference_seq`

It references existing RNX leads and staff users. No non-RNX tables are modified. Apply only migration 010 if migrations 001–009 are already present.

## Validation performed

- TypeScript/TSX syntax transpilation: 117 `.ts`/`.tsx` source files, zero syntax diagnostics.
- Temporary-declaration TypeScript validation: passed with strict checking enabled except `noImplicitAny` (the minimal Zod/framework declarations do not provide the real library type inference). This is not a dependency-backed application typecheck.
- Full dependency installation timed out; therefore a real `npm run typecheck` and Next.js production build were not completed.
- SQL migration reviewed for RNX-only object scope, existing RNX foreign keys, RLS enablement, public/anon/authenticated revocation and service-role grants.
- Static migration/visibility checks passed.
- ZIP integrity: passed; 153 files in the archive.

## Not verified

- A dependency-backed `npm run typecheck` and Next.js production build.
- Migration 010 against the production Supabase project.
- Live complaint submission, supplier linkage, staff assignment, customer reply and internal-note privacy workflows.
- Production deployment.

## Important limitations

- Cases can only be raised against an existing customer request and require its private tracking link.
- File uploads, evidence vault, automatic supplier suspension, supplier KYB/licence verification, legal adjudication, refunds and chargebacks are not included.
- A case status or label such as suspected fraud is a customer report, not a factual or legal finding.
- Customer-visible resolution text is written and approved by RNX staff; internal notes remain restricted.
- Existing release requirements remain: migrations 001–009 must be present before migration 010, and the Vercel production build must pass before release is considered deployed.
