# Build and release status — v0.2.0

## Included
- Full Next.js source tree, routing, layout and responsive styling.
- Multi-industry category taxonomy and search-term matching.
- State request entry pages marked `noindex` until local content and supplier coverage are verified.
- Customer and business application forms.
- Server-side Zod validation and Supabase persistence.
- Server-only database key handling.
- SEO metadata, canonical host, robots and sitemap.
- Additive RNX SQL schema with row-level security enabled and browser-role privileges revoked.

## Not included
- Authentication, supplier/member dashboards, inventory listings, payment gateway, subscription billing, moderation console, automated supplier matching or notifications.
- Live supplier stock or price data.
- A verified supplier directory.

## Validation status
- JSON configuration files authored and syntax-checked while packaging.
- ZIP archive integrity checked after creation.
- Full dependency installation and production compilation: NOT RUN.
- Supabase migration execution: NOT RUN.
- Live customer and supplier form submissions: NOT RUN.
- Vercel production deployment: NOT RUN by this packaging process.

## Important deployment distinction
The Vercel error `A repository ID is required for GitHub deployments` is a Git deployment integration error that occurs before application compilation. Replacing application source does not, by itself, repair a missing repository identifier in Vercel's Git integration.
