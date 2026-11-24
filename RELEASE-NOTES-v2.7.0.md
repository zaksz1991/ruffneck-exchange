# RuffNeck Exchange v2.7.0 — Saved-Offer Change Alerts

## Included

- Customers can explicitly enable or disable email alerts on each saved marketplace offer.
- Alerts cover changes to published price, currency/price type and supplier-reported availability.
- Enabling alerts records the currently published offer values as the baseline; pre-existing changes are not sent as new alerts.
- A price edit made while a listing is paused is detected when the amended listing is approved and republished.
- Only active customers with verified email addresses and an enabled saved-offer alert receive queued emails.
- Alert emails enter the existing `rnx_notifications` outbox. Existing delivery retries and Resend configuration are reused.
- Suppliers' catalogue changes are not blocked by an email outbox failure.
- The customer can disable alerts from the saved-offers section of the customer dashboard.

## Supabase and configuration

Apply `supabase/migrations/019_rnx_saved_listing_change_alerts.sql` after migrations 001–018. It alters only `rnx_customer_saved_listings` and adds RNX-prefixed functions and a trigger on `rnx_listings`. No new Vercel environment variable is required. Existing `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL` and `CRON_SECRET` configuration is required for email delivery. Without the existing email provider configuration, messages remain pending in the outbox. The current daily cron or the Operations console's manual **Process email queue** control handles queued notifications.

## Changed application files

- `app/api/customer/saved-listings/route.ts`
- `components/customer-dashboard.tsx`
- `app/globals.css`
- `supabase/migrations/019_rnx_saved_listing_change_alerts.sql`
- `scripts/test-rnx-v270-saved-offer-alerts.mjs`
- `package.json`
- `README.md`
- `VERCEL_DEPLOYMENT.md`
- `BUILD_STATUS.md`
