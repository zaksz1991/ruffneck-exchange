# Build and release status — v0.4.0

## Included
- All v0.3.0 marketplace, supplier directory, listing and lead intake functionality.
- Private operator sign-in and operations console.
- Supplier application approval/rejection.
- Independent listing approval/rejection, gated on supplier approval.
- Customer lead workflow status management.
- Private server-side queries for contact information.
- Additive audit log migration `003_rnx_admin_operations.sql`.
- No direct customer contact release and no payment approval controls.

## Required setup
- Apply migration 003 after 001 and 002, after checking which migrations have already been run.
- Add `RNX_ADMIN_PASSWORD` and `RNX_ADMIN_SESSION_SECRET` in Vercel Environment Variables.
- Confirm `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured server-side.

## Verification status
- Files generated and JSON/ZIP structure will be checked.
- Full dependency installation, TypeScript typecheck and Next.js production build have not been confirmed yet.
- Supabase migration execution and live data tests have not been performed.
- No production deploy has been performed by this package generator.
