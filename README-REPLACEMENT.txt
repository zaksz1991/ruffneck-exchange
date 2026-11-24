RUFFNECK EXCHANGE v3.1.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete RNX Next.js application, routes, APIs, components, server libraries, public assets, deployment configuration, documentation, regression tests and Supabase migrations 001–023.

New in v3.1.0: dual-confirmed transaction outcomes and verified supplier reviews. After a paid introduction has been approved and contact-released, the customer and supplier can independently report whether the transaction completed. Only matching completion confirmations permit a customer review. Reviews require RNX moderation before public publication; suppliers can publish one response to approved feedback.

The existing marketplace features through v3.0.0 are retained, including supplier listing analytics, customer request timelines, notification centre, saved-offer comparison and alerts, listing photos/galleries, supplier-reported availability, supplier verification, catalogue moderation, customer tracking, lead matching and payment/contact-release controls.

SUPABASE: Confirm migrations 001–022 have succeeded, then apply only `supabase/migrations/023_rnx_verified_transaction_reviews.sql` in the existing RuffNeck Entertainment project. Do not rerun completed migrations.

VERCEL: No new environment variable is required. Keep the current project and Root Directory `./`.
