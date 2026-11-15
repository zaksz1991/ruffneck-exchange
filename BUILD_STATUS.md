# Build and release status — v0.3.0

## Included
- Complete Next.js application source, responsive styling and route structure.
- Multi-industry taxonomy and state navigation.
- Customer sourcing request form and supplier application form.
- Optional first product/service listing submitted with a supplier application.
- Approved supplier directory and public supplier profile pages.
- Approved catalogue with product/service/wholesale/rental categories, search and state/category filtering.
- Individual listing detail pages.
- Separate approval requirements for supplier applications and each listing.
- Server-side catalogue reads; public pages never select supplier contact-person, private email or phone fields.
- Additive SQL migration `002_rnx_catalogue.sql` for the catalogue.
- Dynamic sitemap entries for approved supplier profiles and approved listings.
- RuffNeck Entertainment product showcase, SEO and Vercel setup files.

## Manual work required before inventory appears
- Apply migration 002 after the existing RNX core migration 001.
- Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel as server-only environment variables.
- Review supplier applications and individual listings in Supabase Table Editor.
- Set supplier status to `approved` and listing status to `approved` only after separate reviews.

## Not included
- Login, supplier/member dashboard, self-service listing management, image storage, payments, subscriptions, admin moderation interface, automated supplier matching, notifications, live inventory sync or stock reservation.
- No live supplier inventory or market prices are fabricated.

## Validation status
- Source files and JSON configuration created.
- SQL migration reviewed for additive `rnx_*` scope.
- ZIP archive will be integrity-checked.
- Dependency installation and `next build`: not verified in this environment because package installation did not complete before timeout.
- Supabase migration execution, live database queries, form submissions and Vercel deployment: not performed.

## Deployment integration distinction
The Vercel message `A repository ID is required for GitHub deployments` is a Git integration error that occurs outside the Next.js application build. Replacing source files does not independently fix a missing repository identifier in Vercel's deployment integration.
