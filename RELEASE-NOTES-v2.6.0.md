# RuffNeck Exchange v2.6.0 — Customer Saved-Offer Comparison

## Included

- Customers can select up to three offers from their saved-offer shortlist and compare them side by side in the customer dashboard.
- The comparison includes listing title, supplier, category, listing type, location, published price, supplier-reported availability and save date.
- Each compared offer links back to its public listing and supplier profile.
- Selection is removed when an offer is unsaved and reconciled when the dashboard refreshes its saved-offer data.
- Accessible comparison controls and a horizontally scrollable table support narrow screens.
- The comparison discloses that prices and availability are supplier-reported, currencies are not converted and RNX does not independently verify stock, quality or delivery.

## Supabase and configuration

No new migration or environment variable is required. The feature uses the existing private saved-listing API and requires migration 018 from v2.5.0 to be present in the existing RuffNeck Entertainment Supabase project.

## Changed application files

- `components/customer-dashboard.tsx`
- `app/globals.css`
- `package.json`
- `scripts/test-rnx-v260-customer-offer-comparison.mjs`
- `README.md`
- `VERCEL_DEPLOYMENT.md`
- `BUILD_STATUS.md`
- `REPLACEMENT_MANIFEST.txt`
