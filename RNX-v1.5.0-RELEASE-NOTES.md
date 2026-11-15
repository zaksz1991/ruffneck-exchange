# RuffNeck Exchange v1.5.0 — Account Recovery

This release adds secure password recovery for eligible customer and supplier portal accounts.

## What changed

- Customer and supplier sign-in pages now have separate password-recovery links.
- Recovery emails are sent using the existing Resend provider configuration.
- Reset tokens are cryptographically random, hashed before storage, one-time and valid for 60 minutes.
- Requesting another recovery link invalidates the previous active link for that account.
- Password updates are applied by an atomic, service-role-only database function.
- Both customer and supplier passwords continue to use the existing scrypt password-hash format.
- HMAC-based request throttling limits repeated attempts while avoiding raw email/IP storage in the throttle table.
- Generic responses avoid confirming whether an account exists.
- Recovery emails bypass the general staff notification outbox to keep bearer tokens out of routine operator communications.

## Files

New:
- `app/api/account/recovery/request/route.ts`
- `app/api/account/recovery/complete/route.ts`
- `app/account/recovery/page.tsx`
- `app/account/reset/page.tsx`
- `components/account-recovery-form.tsx`
- `supabase/migrations/012_rnx_account_recovery.sql`
- `RNX_ACCOUNT_RECOVERY.md`
- `scripts/test-account-recovery.mjs`

Replaced:
- `app/customer/login/page.tsx`
- `app/supplier/login/page.tsx`
- `package.json`
- `BUILD_STATUS.md`

## Database and environment

One additive migration is required: `012_rnx_account_recovery.sql`, after migrations 001–011. It creates only RNX-prefixed objects.

The feature reuses the existing Resend and site URL environment variables. An optional `RNX_ACCOUNT_RECOVERY_SECRET` is supported; the existing session secret is the fallback. No new Supabase project or paid provider is introduced.

## Validation and limits

The release includes a static contract test. The full Next.js production build, full repository typecheck, live email delivery, Supabase migration execution, GitHub commit and Vercel deployment have not been performed in this workspace.

Initial email verification and global revocation of other active sessions remain outside this release.
