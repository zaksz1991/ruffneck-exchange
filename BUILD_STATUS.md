# Build and release status — v0.5.0

## Included
- Complete cumulative application from v0.4.0.
- Supplier opportunity offers with anonymised summaries.
- Supplier acceptance recording.
- Exact-fee payment verification and references.
- Private one-time customer consent page with approve/decline decisions.
- Hashed, expiring customer authorisation tokens.
- Atomic database functions for supplier acceptance, payment verification, payment adjustment and contact release.
- Per-offer event history and operator audit logging.

## Required setup
- Keep Vercel Root Directory at `./` and framework at Next.js.
- Keep `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`.
- Confirm `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RNX_ADMIN_PASSWORD` and `RNX_ADMIN_SESSION_SECRET` are configured in Vercel Environment Variables. Never commit secret values.
- If migrations 001–003 are already present, apply only `004_rnx_introduction_workflow.sql`.
- If the earlier RNX migrations have not all been applied, review the migration history and apply missing migrations in order. Do not rerun successful migrations unnecessarily.

## Verification status
- Source files and SQL migration are included in this archive.
- A full dependency install and production build must be run against the final source before production release.
- Supabase migration execution has not been performed by this package.
- Live payment, WhatsApp, email, supplier identity and customer contact-release tests have not been performed.
- Payment checks are manual. The code does not connect to a payment gateway or independently confirm transfers.
- The customer approval link must be sent manually. No messaging provider is configured.
- Contact release must be performed manually after the console confirms payment and customer authorisation; record the release after details have actually been shared.
