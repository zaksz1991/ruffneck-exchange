RUFFNECK EXCHANGE v3.4.0 — COMPLETE CUMULATIVE REPLACEMENT

Project: RuffNeck Exchange (RNX)
Repository: https://github.com/zaksz1991/ruffneck-exchange
Production: https://ruffneck-exchange.vercel.app/
Supabase project: RuffNeck Entertainment

This archive contains the complete Next.js application, App Router pages and API routes, React components, server libraries, public assets, configuration, operational documentation, regression tests, and Supabase migrations 001–025.

This is a complete cumulative repository replacement, not an incremental overlay.

NEW IN v3.4.0 — SUPPLIER COMMERCIAL QUOTATION NOTIFICATIONS
- Supplier dashboards include a private notification centre for customer/system quotation decisions.
- Notifications are generated when a quote becomes selected, not selected, declined or expired.
- Suppliers can mark an individual notification or all notifications as read.
- All reads and updates are scoped to the authenticated supplier. Customer names, email addresses and phone numbers are not copied into supplier notification records.

CUMULATIVE FEATURES RETAINED
Supplier catalogue and moderation; listing editing, images and galleries; supplier availability; customer saved listings, comparisons and alerts; customer and supplier notification centres; customer request timelines; supplier listing analytics; supplier verification and memberships; customer requests and supplier matching; payment verification and customer-authorised contact release; private customer tracking; operations and audit workflows; dual-confirmed transaction outcomes; moderated supplier reviews; commercial quotations; private Operations quotation oversight.

SUPABASE
Confirm migrations 001–024 are already applied. Apply only `supabase/migrations/025_rnx_supplier_quote_notifications.sql` in the existing RuffNeck Entertainment project. Do not rerun completed migrations.

DEPLOYMENT
Extract this archive, open its `ruffneck exchange` folder, replace the existing repository contents with the complete folder contents, and commit to the `main` branch. Retain the existing Vercel project and Root Directory `./`.

BUILD / VALIDATION LIMITS
Cumulative static regression scripts are included. Static checks do not prove a full production build. Full TypeScript semantic typechecking, Next.js production build and live supplier notification checks must be confirmed in Vercel/production. See BUILD_STATUS.md.
