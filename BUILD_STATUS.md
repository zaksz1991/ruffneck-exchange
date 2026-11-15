# Build status — v0.1.0

Implemented in source:
- Next.js application shell and responsive landing page.
- Multi-industry department taxonomy and all Nigerian states.
- Marketplace category and state/category page template.
- Customer request and supplier application UI/API.
- Server-side schema validation.
- Supabase migration for supplier applications, leads, anonymised lead offers and event table.
- Lead contact-release lock default.
- RuffNeck services and platform showcase.
- SEO metadata, sitemap and robots route.
- SEO, research, intermediary operations and Vercel GUI deployment documents.

Not implemented:
- Admin dashboard, authentication, business owner portal, listing CRUD, membership billing, payment gateway, automated lead matching, notifications, analytics consent UI, product sync and automated contact release.
- Live integrations are not configured.
- No production deployment or live database test has been performed.
- Location/category pages are templates and should not be indexed until populated with unique research and real supplier coverage.

This is a working starter foundation, not a finished commercial marketplace. No claim of live functionality beyond the source-level implementation is made.


## v0.1.1 update
- Updated server-side Supabase configuration to prefer the current `SUPABASE_SECRET_KEY` and `SUPABASE_URL` variables.
- Retained `SUPABASE_SERVICE_ROLE_KEY` as a temporary backwards-compatible fallback.
- This is a configuration compatibility update; it does not mean the application has been deployed or end-to-end tested.
