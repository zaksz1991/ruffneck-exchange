# Build status — RuffNeck Exchange v3.16.0

- Baseline: complete cumulative v3.15.0 project.
- Upgrade: supplier-only catalogue CSV export with status filters (all, approved, pending, paused, rejected).
- New API route: `app/api/supplier/listings/export/route.ts`.
- Supplier dashboard: export filter and CSV download control in the catalogue section.
- Export includes listing details, moderation status, supplier-reported availability and timestamps. It excludes customer data, supplier application IDs and private image paths.
- Security: authenticated supplier session, supplier-scoped database query, status allowlist, 10,000-row cap, no-store response headers, explicit column selection and spreadsheet formula-injection neutralisation.
- New regression test: `scripts/test-rnx-v316-supplier-catalogue-export.mjs`, included in `npm run check`.
- Supabase migration: none. Existing migrations 001–032 remain unchanged.
- Vercel environment variables: none added.
- Full TypeScript typecheck and Next.js production build: not verified in this environment; verify using the Vercel deployment log.

## Validation performed

- Regression scripts: all 38 files under `scripts/test-*.mjs` executed successfully.
- TypeScript/TSX syntax transpilation: 191 of 191 files passed using the installed TypeScript compiler API.
- Full project semantic typecheck: not verified because the npm dependency installation did not complete.
- Next.js production build: not verified for the same dependency-installation limitation; Vercel must confirm it after deployment.
