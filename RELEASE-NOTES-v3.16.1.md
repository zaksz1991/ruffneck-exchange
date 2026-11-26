# RuffNeck Exchange v3.16.1 — Supplier Catalogue Export Type Repair

## What changed

- Repairs the production TypeScript build failure in `app/api/supplier/listings/export/route.ts` introduced by the dynamically composed Supabase select-column string.
- Adds a runtime row normaliser that accepts unknown query data, verifies it is an array, and retains only non-null object records before CSV mapping.
- Applies the same normalisation to the first result page and subsequent paginated results. This avoids casting Supabase's `GenericStringError[]` fallback directly to `Record<string, unknown>[]`.
- Preserves supplier ownership filtering, explicit selected fields, pagination, export limits, CSV escaping, formula-injection protection and private/no-store response behaviour.
- No database migration, Storage change, external service or Vercel environment variable is required. Existing Supabase migrations 001–032 remain unchanged.

## Validation

- Added a regression test for the Supabase result normaliser and both pagination paths.
- Full TypeScript semantic typecheck and Next.js production build still require verification in the deployment environment because this working copy has no installed project dependencies.
