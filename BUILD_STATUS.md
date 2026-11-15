# Build status — RuffNeck Exchange v1.7.0

## Release scope
Complete cumulative RNX application, carrying forward v1.6.1 supplier-form repair, v1.6.0 email verification, v1.5.0 account recovery and all earlier marketplace features. Adds supplier-side pause and re-review controls for catalogue listings.

## v1.7.0 supplier catalogue controls
- Suppliers can pause an approved listing; it becomes `paused` and disappears from public results that require approved status.
- Suppliers can resubmit a paused listing; it becomes `pending` and remains private until RNX staff approves it again.
- API requires same-origin validation and an authenticated supplier.
- Database lookup and update are scoped to the authenticated supplier's own records.
- Pending and rejected listings cannot be modified through this endpoint.
- No migration or environment variable is added.

## Carried-forward security
- Customer and supplier email ownership verification.
- Single-use, expiring verification links with hash-only token storage.
- Password recovery with single-use reset tokens.
- Supplier approval and verification remain separate from email ownership confirmation.
- Customer contact details remain locked until the established payment and customer-consent release requirements are met.

## Database
Retains migrations 001–013. No additional migration is required for v1.7.0. Do not rerun previously applied migrations.

## Validation performed in this workspace
- Account recovery static contract test: passed.
- Email verification static contract test: passed.
- Supplier form TypeScript regression contract: passed.
- Supplier listing controls contract: included; execution result recorded in release handoff.
- ZIP integrity checked at packaging.
- Full dependency installation timed out. Full TypeScript typecheck and Next.js production build were not run.
- Live Supabase migration/state, Resend delivery, GitHub commit and Vercel deployment were not performed.
