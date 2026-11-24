# RuffNeck Exchange v2.8.0 — Customer notification centre

## What changed
- Added a private notification centre to the customer dashboard.
- Customers can view updates when a saved public listing's published price, currency/price type or supplier-reported availability changes.
- Notifications include the listing title, supplier name, change summary and a link back to the offer.
- Customers can mark one notification as read or mark all notifications as read.
- The dashboard displays the unread count and retains read/unread state in Supabase.
- Existing v2.7.0 email alerts remain separate: email is still sent only when the customer has explicitly enabled email alerts for that saved offer and has a verified email address.
- The in-app notification centre works independently of email consent and delivery configuration.

## Database
- New migration: `supabase/migrations/020_rnx_customer_notification_centre.sql`.
- Adds per-saved-listing observed-value baselines to avoid sending historical notifications when the migration is first applied.
- Creates `rnx_customer_notifications` with customer ownership, listing snapshots and read timestamps.
- Enables RLS and revokes direct access from `public`, `anon` and `authenticated`; API handlers use the existing server-side service-role client and signed customer session.
- Replaces the existing listing-change trigger function to create in-app notifications for active customers who saved the offer, while retaining separately opted-in email alerts in the existing `rnx_notifications` outbox.

## Deployment
1. Confirm migrations 001–019 are already applied in the RuffNeck Entertainment Supabase project.
2. Apply only `020_rnx_customer_notification_centre.sql`.
3. Deploy the complete project ZIP to the existing `main` branch and allow Vercel to build.
4. No new Vercel environment variables or external services are required.

## Validation scope
- Static regression checks cover customer ownership, active-account checks, same-origin updates, RLS/revokes, notification read state, saved-listing change detection and the preservation of v2.7.0 email opt-in rules.
- Live database migration, trigger execution and actual Vercel production build require deployment verification.
