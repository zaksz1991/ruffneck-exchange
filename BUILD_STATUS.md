# Build status — RuffNeck Exchange v1.6.1

## Release scope
Supplier application TypeScript build repair, carried with v1.6.0 email verification and v1.5.0 account recovery.
Email ownership confirmation for customer accounts and supplier applications, carried together with the v1.5.0 password-recovery overlay.

## Included capabilities
- Customer registration stores an unverified account and does not create a customer session until email confirmation succeeds.
- Customer login verifies the password, then requires email confirmation before issuing a session.
- Supplier applicants receive a one-time email confirmation link after submitting an application.
- Supplier portal login requires a confirmed business email, in addition to approval and enabled portal access.
- Resend links are available from customer sign-in, supplier sign-in and the supplier application confirmation state.
- Confirmation tokens are cryptographically random; only SHA-256 hashes are stored.
- Tokens expire after 60 minutes, are consumed atomically and invalidate older outstanding links for the same account.
- Keyed email/IP rate limiting and generic resend responses reduce account enumeration and abuse.
- A database trigger prevents a new supplier approval transition before the supplier email is confirmed.
- The supplier confirmation marker proves email control only. It is not a business verification, legal-compliance check, product-quality guarantee or badge.
- v1.5.0 password recovery remains included: one-time reset links, scrypt password hashes and atomic password updates.

## Required database sequence
- Check whether `012_rnx_account_recovery.sql` has already been applied. Apply it once if it has not.
- Apply `013_rnx_email_verification.sql` once, after 012.
- Both migrations create or modify only `rnx_`-prefixed RNX objects and the two RNX account tables. They do not modify other RuffNeck applications' tables.

## Existing environment
Reuses `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL` and the existing RNX session secret. Optional: set `RNX_EMAIL_VERIFICATION_SECRET` to a new independent random value of at least 32 characters. Fallback secret selection is documented in `RNX_EMAIL_VERIFICATION.md`.

## v1.6.1 supplier-form build repair
- The submitted supplier email is captured from `FormData` before the attribution object is merged.
- The form no longer reads `data.email` from the merged object.
- The captured email is retained for the confirmation resend action after the form resets.
- A focused regression contract is included.

## Verification scope
- Included static contract tests cover token, rate-limit, access-control, login-gate and approval-gate source contracts.
- ZIP integrity and included text/JSON files are checked in the packaging workspace. The focused supplier-form regression test passed.
- The complete repository checkout and installed Next.js dependencies were not available in this workspace; no full TypeScript project check or Next.js production build is claimed.
- The Supabase migrations were not executed against the live project. Resend delivery and real account flows were not tested in production.
- No GitHub commit or Vercel deployment was performed.

## Existing accounts
Existing customer and approved supplier rows have `email_verified_at = NULL` after migration. They must use the resend action once before they can sign in under this release. Existing approved suppliers remain approved; the trigger blocks only new approval transitions until email confirmation.
