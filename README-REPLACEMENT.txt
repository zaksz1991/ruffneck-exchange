RUFFNECK EXCHANGE v2.9.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete RNX Next.js source project, including application routes and APIs, React components, server libraries, public assets, deployment configuration, project documentation, regression tests and Supabase migrations 001–021.

Retained features include marketplace discovery, customer enquiries and private tracking, supplier profiles and membership, supplier verification, moderation, listing editing, private cover and gallery images, supplier-reported availability, saved offers, offer comparison, saved-offer email alerts and the customer in-app notification centre.

New in v2.9.0: the signed-in customer dashboard displays a chronological request progress timeline, including request submission, workflow status changes and contact-release permission changes.

SUPABASE: Confirm migrations 001–020 have succeeded, then apply only migration 021 in the existing RuffNeck Entertainment project. Migration 021 does not reference listing availability columns. Resolve the earlier v2.8.0 availability prerequisite issue separately before relying on v2.8.0 saved-offer notifications.

VERCEL: No new environment variable is required. Keep existing production environment settings and Root Directory `./`.
