# RNX v0.7.0 — Customer Accounts, Tracking and Communications

## Customer experience
- Customers may submit requests as guests or while signed in.
- Every request receives a high-entropy private tracking link. Its SHA-256 hash, not the raw token, is stored in Supabase.
- The tracking link can view request status and exchange messages with RNX Operations. Treat it like a password: anyone holding it can access that request. The token hash is stored on the lead; when an email receipt is queued, the private link is necessarily included in the restricted notification outbox body until that notification is deleted.
- Registered customers can view requests submitted while signed in and message RNX from the account dashboard. Guest requests are not retroactively attached to accounts based on email addresses.
- Supplier users cannot access customer messages or private request tracking. Supplier matching and introductions remain mediated by RNX.

## Authentication
- Customer passwords are stored as scrypt hashes with random salts.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Customer sessions last 30 days and require `RNX_CUSTOMER_SESSION_SECRET` or the existing `RNX_ADMIN_SESSION_SECRET` fallback (minimum 32 characters).
- Login attempts are rate-limited by database functions.
- Customer email ownership is not verified in this release. Do not treat account email as proof of ownership or as customer introduction consent.

## Operations inbox
- `/admin/communications` is protected by the existing administrator session.
- Operations can read customer threads and reply. Messages are stored in `rnx_lead_messages`.
- Customer contact details remain hidden from supplier portal APIs unless the existing introduction workflow explicitly releases them.

## Email notifications
Configure `RESEND_API_KEY` and `RNX_NOTIFICATION_FROM_EMAIL` in Vercel to attempt email via Resend. Configure `RNX_OPERATIONS_NOTIFICATION_EMAIL` to receive new request and customer-message alerts.

Every outbound email is first recorded in `rnx_notifications`. Without Resend credentials it stays `pending`; failures are marked `failed`. In v0.9.0, a protected scheduled worker retries transient delivery failures, with a maximum of five total attempts. See `RNX_NOTIFICATION_DELIVERY.md`. A provider API acceptance is not a delivery receipt.

## Database migration
Apply `supabase/migrations/006_rnx_customer_accounts_tracking_messaging.sql` only after 001–005 are confirmed applied. It creates only `rnx_*` objects and adds nullable RNX fields to `rnx_leads`. It does not edit non-RNX RuffNeck Entertainment tables. Review the SQL and take a backup before production migration.

## Functional limits
- Guest private tracking links do not expire automatically in this release and cannot be recovered if the customer loses them. When a receipt email is queued, the private link is present in the restricted notification outbox body so it can be delivered to the customer. Email receipt is attempted only when the Resend configuration is valid.
- Customer accounts show only requests submitted while that account was signed in.
- Supplier-to-customer direct messaging is intentionally not enabled; RNX remains the intermediary.
- Email delivery, domain verification, database migration and production end-to-end flows must be tested in the target environment.
