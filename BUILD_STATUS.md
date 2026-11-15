# RuffNeck Exchange v1.9.0 — build and validation status

## Implemented in this overlay
- Marketplace offers can be filtered by product, service, wholesale or rental.
- Pricing filters distinguish fixed price, starting price and price on request.
- Results can be sorted by newest, oldest or offer name A–Z.
- Listing type and pricing filters are applied in the Supabase query before the bounded result set is fetched.
- Category and state navigation preserves the active marketplace context.
- Result count, active filter summary, clear-filter route and sourcing-request fallback are included.
- The v1.8 operations improvements and the request-page TypeScript state-validation repair are retained in the package.

## Focused validation run in this package workspace
- v1.8.0 operations contract test: 20 assertions passed.
- v1.9.0 marketplace search contract test: 32 assertions passed.
- ZIP archive integrity: passed.
- Package JSON parsing: passed.
- JavaScript test-script syntax: passed.
- TypeScript/TSX transpile syntax checks: 6 changed source files passed (syntax only; not a full semantic type-check).
- Static check confirms the TypeScript state fix uses `new Set<string>(site.states).has(requestedState)` and preserves the state allow-list.

## Not run / not established
- Full repository `npm run check`.
- Full TypeScript project check against the installed full-repository dependency tree.
- Full Next.js production build.
- Live Supabase query execution, actual catalogue filtering or Vercel deployment.
- No production database, account, payment or email configuration was changed by this package.

The package is an incremental overlay, not a full source repository replacement. It must be merged into the existing RuffNeck Exchange repository before full-project validation.

## Database and environment
- No SQL migration required.
- No new environment variable.
- Existing `rnx_listings` fields are reused.
- No payment gateway, external integration or non-RNX Supabase object changed.
