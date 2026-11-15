# Build status — RuffNeck Exchange v1.5.0

## Scope
One-time password recovery for eligible customer and supplier portal accounts.

## Implemented in this release
- Separate recovery entry points from customer and supplier sign-in pages.
- Email reset links are sent through the existing Resend configuration.
- Cryptographically random, single-use tokens; only SHA-256 token hashes are stored in the RNX database.
- Recovery links expire after 60 minutes; requesting a new link invalidates prior outstanding links for that account.
- Atomic database-side token consumption and password update.
- Scrypt password hashes are retained for both account types.
- HMAC-keyed request throttling limits recovery requests without storing raw email addresses or IP addresses in the rate-limit table.
- Generic confirmation text avoids disclosing whether an email belongs to an eligible account.
- The recovery email is sent directly through Resend rather than stored in the general operations email outbox, so reset tokens are not exposed in the ordinary communications console.

## Required migration
- `supabase/migrations/012_rnx_account_recovery.sql`
- Apply once, after migrations 001–011.
- No existing non-RNX table or function is modified.

## Environment
- Reuses `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL`, and `NEXT_PUBLIC_SITE_URL`.
- Uses `RNX_ACCOUNT_RECOVERY_SECRET` when provided; otherwise uses the existing customer, supplier or admin session secret fallback. The selected secret must contain at least 32 characters.
- No new paid provider or Supabase project is required.

## Validation scope
- Static account-recovery contract test included and run in the release workspace.
- TypeScript source parse checks performed for the included files.
- Full repository typecheck and Next.js production build not run because the full repository checkout and installed project dependencies were not available in this workspace.
- Migration not executed against the production Supabase project.
- No GitHub commit or Vercel deployment was made.

## Security limitations
- This release does not add email verification to account registration.
- Password reset clears the current browser's matching account cookie. Other signed sessions remain valid until their existing expiry.
- Email delivery depends on an active Resend API key and a sender address verified with Resend.
