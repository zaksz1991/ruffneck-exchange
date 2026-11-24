# RuffNeck Exchange v2.8.0 — build and validation status

## Included functionality
- Complete cumulative RNX source retained through v2.7.0.
- Added a private in-app notification centre to the customer dashboard.
- Active customers who saved a public listing receive an in-app notification when its published price/price type/currency or supplier-reported availability changes.
- Notifications include listing and supplier context, a listing link, timestamp and read/unread state.
- Customers can mark individual notifications or all notifications as read.
- Existing v2.7.0 email alerts remain separately opt-in and continue to require an active customer, verified email and `alerts_enabled = true`.

## Security and database
- New API: `GET/PATCH /api/customer/notifications`.
- API access requires a valid active customer session. Read-state changes require a same-origin request and are scoped to the signed-in customer ID.
- Notification records are private in `rnx_customer_notifications`; RLS is enabled and direct `public`, `anon` and `authenticated` access is revoked.
- New migration: `020_rnx_customer_notification_centre.sql`.
- Migration adds independent in-app change baselines to saved listings and updates the listing-change trigger while preserving v2.7.0's separate verified-email/opt-in email flow.
- No new Vercel environment variable or external service is required.

## Validation
- Added `test-rnx-v280-customer-notification-centre.mjs`.
- Retained all prior cumulative regression scripts and added v2.8.0 to `npm run check`.
- Static regression and TypeScript syntax checks are run against the delivered source; full semantic typechecking and Next.js production build require dependencies and final Vercel confirmation.
- Live Supabase migration/trigger execution and real customer notification behaviour have not been verified in production.

## Deployment
- Apply only migration 020 after confirming migrations 001–019 are already applied in RuffNeck Entertainment.
- Deploy this complete project to `github.com/zaksz1991/ruffneck-exchange`, branch `main`, using the existing Vercel project and Root Directory `./`.
