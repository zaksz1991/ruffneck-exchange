# RuffNeck Exchange v3.4.0 — Supplier Commercial Quotation Notifications

## New functionality

- Adds a private supplier notification centre to the supplier dashboard.
- The database creates a supplier notification when an existing commercial quotation changes to `selected`, `not_selected`, `declined` or `expired`.
- Suppliers see the latest 40 notifications and the total unread count.
- Suppliers can mark an individual notification or all notifications as read.
- Notifications link back to the supplier opportunity inbox.

## Security and data boundaries

- Notification reads and updates are scoped to the authenticated supplier application ID.
- Same-origin protection is applied to read-state updates.
- The notification table has RLS enabled and direct `public`, `anon` and `authenticated` privileges revoked.
- The supplier notification payload contains quote status messages only; it does not copy customer names, email addresses or phone numbers.
- The feature does not expose customer contact details or change the existing contact-release gates.

## Database and configuration

- Adds `supabase/migrations/025_rnx_supplier_quote_notifications.sql`. Apply it after migrations 001–024.
- No new Vercel environment variables or third-party providers are required.
- The existing commercial quotation workflow and migration 024 remain in place.

## Verification boundary

- Static regression coverage checks migration objects, status handling, supplier scoping, same-origin enforcement and dashboard UI.
- Full TypeScript semantic typechecking, Next.js production build and live database/portal checks must be confirmed in Vercel and the existing RuffNeck Entertainment Supabase project.
