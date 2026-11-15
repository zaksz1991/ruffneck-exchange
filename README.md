# RuffNeck Exchange (RNX) — v0.5.0

A multi-industry, multi-location customer-acquisition marketplace connecting customers with products, services, suppliers, businesses, wholesale providers and procurement opportunities. Refrigeration, cold rooms and solar remain categories only; they do not define the brand.

## Core model
RNX receives a customer's sourcing request, verifies the requirement and permission, shares an anonymised opportunity with suitable approved suppliers, records supplier acceptance and payment, then obtains the customer's authorisation before contact details are released. Customer browsing and requests are free. Suppliers may pay for memberships, promoted placement and qualified opportunities under clearly stated terms.

Never sell or release customer contact information without disclosure and permission. Membership does not guarantee leads or ranking. Supplier approval is not a guarantee of stock, licence, product condition, delivery or transaction performance.

## v0.5.0 features
- Responsive multi-industry marketplace, supplier directory and approved catalogue.
- Customer sourcing request and supplier application forms.
- Individual approved supplier and listing pages.
- Private operations console at `/admin/login`.
- Supplier and listing moderation, plus lead qualification.
- Supplier opportunity offers with anonymised summaries and agreed fees.
- Manual recording of supplier acceptance.
- Manual payment verification using the actual transaction reference and exact agreed amount.
- Expiring, unguessable customer consent links; only a hash is stored in Supabase.
- Customer approve/decline page that does not expose the customer's personal information.
- Atomic database checks preventing contact release unless supplier payment is verified and the customer has approved.
- Offer event history and operator audit records.

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
The RNX schema is additive and uses `rnx_*` tables. Review target project contents and migration history before applying. Apply only migrations not already run, in order:

1. `001_rnx_core.sql`
2. `002_rnx_catalogue.sql`
3. `003_rnx_admin_operations.sql`
4. `004_rnx_introduction_workflow.sql`

For an installation where 001–003 are already applied, apply only migration 004. Do not rerun earlier migrations unnecessarily. Do not modify existing non-RNX RuffNeck Entertainment tables.

## Supplier introduction operating sequence
1. Qualify the customer request in the operations console.
2. Create a supplier offer using an anonymised brief. Do not include the customer's name, email, phone number or other identifying information.
3. Send the anonymised opportunity and fee/terms to the approved supplier outside RNX. Record the supplier's explicit acceptance in the console.
4. Verify the exact fee against the bank or payment-provider transaction record. Record the transaction reference and exact amount. A transfer screenshot or verbal claim is not proof.
5. Send the customer approval link privately through the customer's preferred channel. The link expires after seven days and can be regenerated before the customer decides.
6. Customer can approve or decline the specific supplier introduction. Declining does not incur a customer fee.
7. Only after supplier acceptance, verified payment and customer approval may staff share the customer's contact information with that supplier. Record the release after it actually happens.

The database functions enforce supplier acceptance before payment verification, exact fee matching, and both paid status plus customer approval before contact release. The application does not send WhatsApp, SMS or email automatically. Staff must send the anonymised supplier brief and customer consent link manually using approved channels.

## Vercel
- Framework: Next.js
- Root Directory: `./`
- Build: `npm run build`
- Production URL: `https://ruffneck-exchange.vercel.app/`

A connected Git repository does not prove that a deployment build succeeds. Inspect the Vercel deployment build log after committing.

## Not included
- Supplier self-service accounts/dashboard.
- Payment gateway or automatic bank reconciliation.
- Automatic WhatsApp, SMS or email delivery.
- Public customer account or request tracking.
- Subscription billing, inventory sync, automated supplier matching or multi-user staff roles.

The operations console is a single-password operator gate. Use a strong unique password, restrict Vercel project access and keep all secrets server-side. Vercel Hobby is not assumed to grant a commercial-use entitlement; check the plan terms before monetised production.
