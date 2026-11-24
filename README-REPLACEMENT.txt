RUFFNECK EXCHANGE v3.5.0 — COMPLETE CUMULATIVE REPLACEMENT

Project: RuffNeck Exchange (RNX)
Repository: https://github.com/zaksz1991/ruffneck-exchange
Production: https://ruffneck-exchange.vercel.app/
Supabase project: RuffNeck Entertainment

This archive contains the complete Next.js application, App Router pages and API routes, React components, server libraries, public assets, configuration, operational documentation, regression tests, and Supabase migrations 001–025.

This is a complete cumulative repository replacement, not an incremental overlay.

NEW IN v3.5.0 — CUSTOMER COMMERCIAL QUOTATION COMPARISON
- Customers can select up to three supplier quotations attached to the same sourcing request and compare them side by side.
- The comparison shows supplier, quote reference/title, proposed amount and currency, scope/specification, delivery/payment terms, estimated fulfilment, validity and status.
- Comparison selections are isolated by request and can be removed individually or cleared.
- Different currencies are not converted or ranked. The comparison explicitly warns customers when the selected quotations use different currencies.
- The comparison is informational only. It does not select a quotation, create an order, initiate payment or change any commercial quote record.

CUMULATIVE FEATURES RETAINED
Supplier catalogue and moderation; listing editing, images and galleries; supplier availability; customer saved listings, comparisons and alerts; customer and supplier notification centres; customer request timelines; supplier listing analytics; supplier verification and memberships; customer requests and supplier matching; payment verification and customer-authorised contact release; private customer tracking; operations and audit workflows; dual-confirmed transaction outcomes; moderated supplier reviews; commercial quotations; private Operations quotation oversight; supplier commercial quote notifications.

SUPABASE
No new migration is required. Existing migrations 001–025 remain unchanged in RuffNeck Entertainment.

DEPLOYMENT
Extract this archive, open its `ruffneck exchange` folder, replace the existing repository contents with the complete folder contents, and commit to the `main` branch. Retain the existing Vercel project and Root Directory `./`.

BUILD / VALIDATION LIMITS
Cumulative static regression scripts are included. Static checks do not prove a full production build. Full TypeScript semantic typechecking and the Next.js production build must be confirmed in Vercel. See BUILD_STATUS.md.
