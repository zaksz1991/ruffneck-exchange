# Build status — RuffNeck Exchange v3.16.1

- Baseline: complete cumulative v3.16.0 project.
- Repair: Supabase query result normalisation in `app/api/supplier/listings/export/route.ts` to resolve the Vercel TS2352 incompatibility between `GenericStringError[]` and `Record<string, unknown>[]`.
- Both the first export page and subsequent pages now pass through `asListingRows`, which checks for an array and keeps only non-null object records.
- Existing supplier scoping, status allowlist, 10,000-row export cap, explicit select, CSV escaping, formula-injection neutralisation and no-store headers are retained.
- New regression test: `scripts/test-rnx-v3161-supplier-catalogue-export-type-fix.mjs`, included in `npm run check`.
- Supabase migration: none. Existing migrations 001–032 remain unchanged.
- Vercel environment variables: none added or changed.

## Validation performed

- Regression scripts: all 39 `scripts/test-*.mjs` files passed.
- TypeScript/TSX syntax transpilation: all 192 TypeScript/TSX files passed using the installed TypeScript compiler API.
- Full project semantic typecheck and Next.js production build: not run because project dependencies are not installed in this working copy. The Vercel build log must confirm both after deployment.
