RUFFNECK EXCHANGE v2.7.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete RNX Next.js source project, including application routes and APIs, React components, server libraries, public assets, deployment configuration, project documentation, regression tests and Supabase migrations 001–019.

Retained features include marketplace discovery, customer enquiries and private tracking, supplier profiles and membership, supplier verification, moderation, listing editing, private cover and gallery images, supplier-reported availability, saved offers and offer comparison.

New in v2.7.0: customers can explicitly enable or disable email alerts per saved offer. When a watched offer's published price or supplier-reported availability changes, RNX queues an email for the customer's verified email address.

SUPABASE: Apply only migration 019 after confirming migrations 001–018 have succeeded in the RuffNeck Entertainment project.

VERCEL: No new environment variable is required. Existing Resend and CRON configuration is reused. The current notification cron processes the outbox daily; Operations can process it manually. Keep the existing environment configuration and Root Directory `./`.
