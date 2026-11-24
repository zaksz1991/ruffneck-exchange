# RuffNeck Exchange v2.6.0 — build and validation status

## Included functionality
- Complete cumulative RNX project retained through v2.5.0.
- Customer dashboard supports side-by-side comparison of two or three saved marketplace offers.
- Comparison includes supplier, category, listing type, location, published price, supplier-reported availability and saved date.
- Customer can return to each listing or supplier profile from the comparison.
- Selection is capped at three, cleared when an offer is unsaved and reconciled when saved-offer data refreshes.
- Mobile layout uses a horizontally scrollable comparison table.

## Security and database
- Comparison uses the existing authenticated customer dashboard data returned by `/api/customer/saved-listings`.
- No customer or supplier data is added to browser storage or a new database table.
- No Supabase migration or Vercel environment variable is required for v2.6.0. Migration 018 from v2.5.0 remains required for the cumulative saved-offer feature.
- Comparison makes no price-conversion or independent verification claims.

## Validation
- Added `test-rnx-v260-customer-offer-comparison.mjs` for selection limits, comparison contents, currency and availability disclaimers, responsive styling and version integration.
- Existing v2.0.0–v2.5.0 regression scripts are retained.
- Full TypeScript semantic checking and Next.js production build were not executed in this environment because the project's npm dependencies are not installed locally. Confirm both with Vercel after deployment.

## Deployment
- No new SQL is required. Confirm migration 018 is already applied in the existing RuffNeck Entertainment Supabase project.
- Keep the existing production Vercel environment variables and Root Directory `./`.
