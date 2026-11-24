# RuffNeck Exchange v2.7.0 — build and validation status

## Included functionality
- Complete cumulative RNX project retained through v2.6.0.
- Customers can explicitly enable/disable email change alerts on individual saved offers.
- Database trigger queues one email for active, email-verified customers when a watched listing's published price/currency/price type or supplier-reported availability changes.
- Baseline values are captured when alerts are enabled; paused listing price edits are detected when the listing is re-approved.
- Alerts use the existing RNX notification outbox, retry worker and Resend integration.

## Security and database
- Customer preference changes require a signed-in customer session and same-origin request. The database RPC scopes changes to the authenticated customer ID supplied by the server.
- Alert email is sent only to active customers with a verified email address and an explicit per-listing opt-in.
- New migration: `019_rnx_saved_listing_change_alerts.sql`. It adds columns to `rnx_customer_saved_listings`, a service-role-only preference function and a trigger on `rnx_listings`.
- No new Vercel environment variable is required. Existing Resend and cron configuration is reused. Notifications remain queued if the provider credentials are not configured. The current daily cron means delivery is not immediate; Operations can process the queue manually.

## Validation
- Added `test-rnx-v270-saved-offer-alerts.mjs` covering dashboard opt-in controls, same-origin API update, service-role RPC, verified-email filtering, trigger coverage and version integration.
- Prior cumulative regression scripts are retained.
- TypeScript/TSX syntax transpilation passed for the two changed application files using the installed TypeScript compiler. Full semantic TypeScript checking and Next.js production build require project dependencies; Vercel must confirm both after deployment. Live Supabase trigger and real-email tests remain required.

## Deployment
- Apply only migration 019 after confirming migrations 001–018 are present in RuffNeck Entertainment.
- Keep existing Vercel environment variables and Root Directory `./`.
