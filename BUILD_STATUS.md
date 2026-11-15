# Build status — RuffNeck Exchange v0.7.0

## Included in this package
- Cumulative project based on v0.6.0.
- Customer registration, sign-in and sign-out with scrypt password hashing and signed HttpOnly session cookies.
- Customer request dashboard for requests submitted while signed in.
- High-entropy guest request tracking links, with only SHA-256 token hashes stored server-side.
- Customer-to-RNX message threads, guest tracking-link messaging and protected administrator response inbox.
- Email notification outbox with optional Resend delivery.
- Additive Supabase migration 006.

## Verification
- Source files and package configuration copied into a complete replacement archive.
- ZIP integrity and JSON syntax are checked by the packaging step.
- A full dependency-backed TypeScript check, `next build`, Supabase migration execution and production integration tests have NOT been run.
- Email delivery is not verified. Without Resend credentials, notifications remain pending.

## Required action before release
Apply migration 006 after confirming 001–005 are already applied; configure the customer session secret; optionally configure Resend; then test customer registration, login, guest tracking, customer messages, admin replies, privacy boundaries and email delivery in a preview deployment.
