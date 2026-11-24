RUFFNECK EXCHANGE v2.8.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete RNX Next.js source project, including application routes and APIs, React components, server libraries, public assets, deployment configuration, project documentation, regression tests and Supabase migrations 001–020.

Retained features include marketplace discovery, customer enquiries and private tracking, supplier profiles and membership, supplier verification, moderation, listing editing, private cover and gallery images, supplier-reported availability, saved offers, offer comparison and separately opted-in saved-offer email alerts.

New in v2.8.0: the signed-in customer dashboard includes an in-app notification centre for saved-offer price and availability changes, with unread counts and read-state controls.

SUPABASE: Confirm migrations 001–019 have succeeded, then apply only migration 020 in the RuffNeck Entertainment project.

VERCEL: No new environment variable is required. Existing Resend and CRON configuration is reused only for email alerts; in-app notification display does not depend on email delivery. Keep the existing environment configuration and Root Directory `./`.
