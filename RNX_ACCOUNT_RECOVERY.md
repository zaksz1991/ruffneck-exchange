# RNX v1.5.0 — Customer and supplier password recovery

## User-facing behaviour

The customer sign-in page links to `/account/recovery?type=customer`. The supplier sign-in page links to `/account/recovery?type=supplier`.

The recovery page accepts the account's registered email address. It shows a generic confirmation and does not confirm whether an account exists. Eligible customer accounts must be active. Eligible supplier accounts must be approved and have portal access enabled.

The application sends a one-time reset link through the existing Resend email configuration. The link expires after 60 minutes. Requesting another link invalidates earlier outstanding links for the same account. Only a SHA-256 hash of the random token is persisted in `rnx_account_recovery_tokens`.

The reset endpoint updates the matching account's existing scrypt password hash through an atomic database function. The database marks all outstanding reset tokens for that account as consumed in the same transaction. A reset link cannot be reused or used against the other account type.

## Database migration

Apply `supabase/migrations/012_rnx_account_recovery.sql` once after migrations 001–011. Check the existing migration history first; do not rerun migration 012 if it has already been applied.

The migration creates only:

- `rnx_account_recovery_tokens`
- `rnx_account_recovery_limits`
- `rnx_account_recovery_allow_request(...)`
- `rnx_consume_account_recovery_token(...)`

Both tables have RLS enabled and are unavailable to `anon` and `authenticated`. Table privileges and function execution are restricted to `service_role`. No Prospector, Social Hub, LMS, billing or other non-RNX object is changed.

## Existing environment variables

The feature reuses:

- `RESEND_API_KEY`
- `RNX_NOTIFICATION_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`
- `RNX_CUSTOMER_SESSION_SECRET`, `RNX_SUPPLIER_SESSION_SECRET` or `RNX_ADMIN_SESSION_SECRET` for the HMAC throttle key.

An optional dedicated `RNX_ACCOUNT_RECOVERY_SECRET` may be set. Use a random value of at least 32 characters. Keep all secrets server-side. Do not add a `NEXT_PUBLIC_` prefix to secrets.

The sender configured in `RNX_NOTIFICATION_FROM_EMAIL` must already be verified by Resend. Without `RESEND_API_KEY` and a verified sender, the API returns a configuration error before looking up an account.

## Operational and security notes

- The reset email is sent directly through Resend. It is intentionally not written to `rnx_notifications`, because the reset URL contains a temporary bearer token and must not appear in the general staff communications outbox.
- Only a token hash is stored in Supabase. The un-hashed token exists only in the request process and the outbound email.
- Requests are throttled by an HMAC fingerprint derived from account type, normalized email and the request IP. Raw email and IP are not saved in the rate-limit table.
- The request endpoint uses a generic response for unknown accounts and rate-limited requests.
- Passwords must contain at least 10 characters and continue to use scrypt hashes.
- The feature does not independently verify email ownership during initial registration. It only provides password recovery to an eligible existing account.
- Resetting a password clears the current browser's matching session cookie. Existing sessions on other devices remain valid until their normal expiry; this release does not add global session revocation.
- If an eligible user does not receive a link, check Resend sender/domain verification and provider logs. Do not ask the user to send a password or reset token to staff.
