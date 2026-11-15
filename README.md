# RuffNeck Exchange (RNX) — v0.4.0

A multi-industry, multi-location customer-acquisition marketplace connecting customers with products, services, suppliers, businesses, wholesale providers and procurement opportunities. Refrigeration, cold rooms and solar remain categories only; they do not define the brand.

## Core model
RNX receives a customer's sourcing request, verifies the need and permission, shares an anonymised opportunity with suitable suppliers, records the supplier's acceptance/payment under the approved process, and obtains customer authorisation before releasing contact details. Customer browsing and requests are free. Suppliers may pay for memberships, promoted placement and qualified opportunities under clearly stated terms.

Never sell or release customer contact information without disclosure and permission. Membership does not guarantee leads or ranking. Supplier approval is not a guarantee of stock, licence, product condition, delivery or transaction performance.

## v0.4.0 features
- Responsive multi-industry marketplace, supplier directory and approved catalogue.
- Customer sourcing request and supplier application forms.
- Individual approved supplier and listing pages.
- Private operations console at `/admin/login`.
- Separate supplier and listing moderation.
- Customer lead qualification queue.
- Server-side audit log for operator status changes.

## Requirements
- Node.js 22 LTS or newer.
- Supabase JS client configured with server-only environment variables.
- Vercel deployment with Root Directory `./`.

## Environment setup
Copy `.env.example` to `.env.local` for local development, then configure values privately. Set in Vercel:

- `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RNX_ADMIN_PASSWORD`
- `RNX_ADMIN_SESSION_SECRET` (at least 32 characters)

Never commit actual secrets or expose them through `NEXT_PUBLIC_` variables.

## Database migrations
The RNX schema is additive and uses `rnx_*` tables. Review target project contents before applying migrations. Existing deployments may already have run 001 and 002. Apply only migrations that are still outstanding, in order:

1. `001_rnx_core.sql`
2. `002_rnx_catalogue.sql`
3. `003_rnx_admin_operations.sql`

Do not alter existing non-RNX RuffNeck Entertainment tables. See `RNX_ADMIN_OPERATIONS.md` for the operations workflow and security boundaries.

## Vercel
- Framework: Next.js
- Root Directory: `./`
- Build: `npm run build`
- Production URL: `https://ruffneck-exchange.vercel.app/`

A connected Git repository does not prove that a deployment build succeeds. Inspect the Vercel deployment build log after committing.

## Limitations
No member login, supplier self-service dashboard, payment gateway, subscription billing, customer contact-release workflow, automated supplier matching, SMS/WhatsApp/email notifications, live inventory sync or multi-user role system is included yet. The admin console is a single-password operator gate and must be protected with strong secrets and restricted platform access.
