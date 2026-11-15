# RuffNeck Exchange v1.6.0 — Email Ownership Verification

## Main improvement
Customer and supplier access now depends on proof that the account holder controls the email address.

### Customers
- Registration creates an unverified account and sends a one-time email confirmation.
- No customer session is issued during registration.
- Correct credentials are not sufficient to sign in until the confirmation link is consumed.
- Customer sign-in includes a resend option for unverified accounts.

### Suppliers
- New business applications receive a business-email confirmation link.
- Supplier portal sign-in requires a confirmed business email in addition to supplier approval and enabled portal access.
- A database trigger blocks a new approval transition while the business email remains unconfirmed.
- Existing approved suppliers stay approved; they must confirm their email once before the portal login is allowed.
- Email confirmation is separate from business verification and does not create a verified badge.

### Security
- 256-bit random single-use tokens; SHA-256 hashes only are stored.
- 60-minute expiry and atomic one-time token consumption.
- Prior outstanding links are invalidated on reissue.
- HMAC-keyed email/IP throttling.
- Generic resend responses to limit account enumeration.
- Verification token data remains server-only; the Resend email is not placed in the general operations notification outbox.

### Carried forward from v1.5.0
Password recovery for eligible customer and approved supplier accounts remains included in the package. The account recovery migration and source files are carried forward, so this v1.6 patch can be applied directly over v1.4.0.

## Database
- Migration 012: account recovery (apply only if not already applied).
- Migration 013: email verification (apply once after migration 012).

## Validation boundary
Static contracts and package/ZIP structure are validated in the preparation workspace. The full application typecheck/build, live migration execution, Resend delivery, live account flows, GitHub commit and Vercel deployment remain unverified.
