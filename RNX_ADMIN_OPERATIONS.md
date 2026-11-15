# RNX v0.4.0 — private operations console

## What this release adds
- Private `/admin/login` sign-in and `/admin` operations console.
- Server-side review of pending supplier applications and catalogue listings.
- Separate approval of the supplier and each published listing.
- Customer lead queue with workflow statuses: new, qualifying, qualified, matched, closed and invalid.
- Audit records for successful supplier, listing and lead status changes.
- Customer contact details are returned only to authenticated operator requests and are not included in public pages.
- Changing a lead's workflow status never releases customer contact details.

## Required Vercel environment variables
Set all four variables for Production (and Preview only if the operator console is needed there):

- `SUPABASE_URL`: the URL of the already-approved Supabase project hosting RNX tables.
- `SUPABASE_SECRET_KEY`: server-only Supabase secret key. The existing legacy service-role fallback remains supported.
- `RNX_ADMIN_PASSWORD`: a unique, strong administrator password. Do not reuse a RuffNeck account password.
- `RNX_ADMIN_SESSION_SECRET`: a cryptographically random secret of at least 32 characters. Keep it private and do not commit it.

Do not put any of these values in `NEXT_PUBLIC_` variables or client-side code. Never send the values in chat.

## Database migration
Apply `supabase/migrations/003_rnx_admin_operations.sql` after migrations 001 and 002. It creates only `rnx_admin_audit_log`, enables RLS and revokes browser roles. It does not edit LMS, Social Hub, billing, Prospector, CALLORIA or other non-RNX tables.

Do not rerun migrations 001 or 002 if their RNX tables already exist. The migration is idempotent for the audit table and indexes, but still review the target project before execution.

## Operator workflow
1. Open `/admin/login` and sign in.
2. Review the supplier application, checking business name, contact data, business type, location, category, description and any required verification documents through your own process.
3. Approve or reject the supplier application.
4. Review each submitted offer separately. A listing cannot be approved until its supplier is approved.
5. Review customer requests and change only their internal qualification status.
6. Do not share customer contact details with suppliers merely because a lead is qualified or matched.
7. The separate lead-offer payment and customer-authorisation process must be satisfied before contact release. This console deliberately does not implement contact release or payment marking.

## Security and operational limits
- Admin session cookie is HttpOnly, SameSite=Strict, Secure in production and expires after eight hours.
- Mutating requests validate same-origin browser requests.
- This release uses one environment-configured operator password, not multi-user accounts, per-person roles or SSO.
- Add platform-level rate limiting / firewall protection before exposing the admin URL broadly. Basic deployment-level throttling is not claimed here.
- Rotate the admin password and session secret if either is exposed. Changing the session secret invalidates existing sessions.
- Audit writes are attempted after a successful status update. Check `rnx_admin_audit_log` regularly; an audit insert failure is logged server-side and does not roll back the status change.
- Configure a proper password manager and restrict Vercel/Supabase project access to trusted administrators.

## Verification boundary
The source package includes route-level checks by inspection and static file validation only. It has not been connected to your production Supabase project, the migration has not been executed, and a live Vercel production deployment has not been tested by this package generation.


## v0.5.0 — supplier introduction workflow

The supplier offer, supplier acceptance, payment verification, private customer approval link and contact-release process is documented in `RNX_INTRODUCTION_WORKFLOW.md`. Migration `004_rnx_introduction_workflow.sql` adds the per-offer event record and database functions used by this workflow. Do not record a contact release until the handoff has actually happened.

## v0.6.0 — supplier membership and portal operations

Membership requests, quotations, supplier payment references and paid-plan verification are handled at `/admin/memberships`. Only verify a payment after checking the actual account statement or provider record. The database activates a paid subscription only when the amount and currency match the current quote. Membership does not guarantee enquiries or ranking.

New applicants set a password on the application form; approval enables the portal and assigns the no-cost Starter plan. For older approved records, generate a one-time supplier portal invite from the membership operations screen and send it privately to the approved business email. The link expires after seven days. The portal reads supplier-owned listings and offers only; customer contact information remains redacted until the authorised release workflow is complete.


## v0.6.0 supplier portal operations

Supplier offer accept/decline decisions are now recorded by the supplier in `/supplier/dashboard`; staff should not record acceptance on a supplier's behalf without explicit agreement. Membership quotations and supplier activation links are managed at `/admin/memberships`. For membership payment verification, enter the actual amount, currency and transaction reference independently confirmed in the receiving account. The database compares those values with the quote before activating the paid plan.


## v1.1.0 staff accounts and role controls

The owner can manage individual staff accounts at `/admin/staff`. Staff use invited email/password sign-in. Available roles are Owner, Operations administrator, Finance, Customer support and Analyst. The server enforces the role at API and page boundaries. Account suspension is checked against Supabase on each protected request and takes effect on the next request. Owner-only management includes invitations, role changes, suspensions and recent staff activity. Invitation links are single-use, expire after 48 hours and must be shared privately. See `RNX_STAFF_ACCESS_CONTROL.md` for full access matrix and migration 009. The environment-password admin login remains the owner recovery path.
