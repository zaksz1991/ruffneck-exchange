# RuffNeck Exchange (RNX) — v1.8.0

**Products. Services. Businesses. Opportunities.**

RuffNeck Exchange is a Nigeria-first, multi-industry business-to-business marketplace and sourcing intermediary. It helps customers describe what they need and connects suitable enquiries with reviewed suppliers, manufacturers, wholesalers, distributors, service providers and commercial partners. The platform is designed to expand across locations and markets without being tied to one industry.

Production: https://ruffneck-exchange.vercel.app/  
Repository: https://github.com/zaksz1991/ruffneck-exchange  
Canonical domain: `https://ruffneck-exchange.vercel.app`

## How RNX operates

1. Customers browse categories or submit a free sourcing request.
2. RNX reviews and qualifies the requirement.
3. Staff use category, location and requirement evidence to identify suitable approved suppliers. Supplier participation is voluntary.
4. The supplier receives an anonymised opportunity brief and accepts or declines the agreed terms.
5. Any supplier introduction fee is independently verified against the receiving account record. RNX does not treat a screenshot or a supplier-submitted claim as proof of payment.
6. The customer separately approves or declines the proposed introduction.
7. Customer contact details are released only after the required supplier acceptance, payment verification and customer permission have been recorded.

Customers can submit requests without paying RNX. Supplier memberships, promoted listings, advertising and qualified introductions are services of RuffNeck Knowledge Hub's RNX marketplace operation. Purchases of third-party goods and services are arranged and paid for directly with the relevant supplier. **Automated payment-gateway checkout is not active in this release; applicable RNX fees still use manual payment verification.**

## Current v1.8.0 changes

- Classifies supplier/listing/lead update failures with actionable operational messages instead of masking all Supabase errors as one generic failure.
- Explains the supplier email-confirmation rule when migration 013 blocks a new supplier approval. The rule is preserved; the application does not bypass email ownership checks.
- Distinguishes database business-rule, schema, permission and duplicate-record failures without returning database internals to the browser.
- Improves empty marketplace conversion by clearly presenting the free sourcing request route and supplier registration route when no approved inventory is available.
- Retains a selected category and location when a visitor moves from filtered marketplace discovery into a sourcing request, pre-filling those fields without inventing customer details.
- Updates the public process explanation to match the implemented operations model and accurately disclose manual fee verification.

## Platform features

- Multi-industry department and state discovery, approved supplier profiles and separately moderated product/service listings.
- Customer sourcing requests, private guest tracking links, optional customer accounts and customer-to-operations messages.
- Staff operations console with role-based access, supplier/listing moderation, lead qualification and audit records.
- Supplier matching recommendations for staff review; recommendations do not automatically create offers or disclose customer details.
- Supplier portal with private anonymised opportunities, accept/decline decisions, catalogue controls and membership operations.
- Manual introduction-fee and membership-payment verification, customer consent links and database-enforced contact-release checks.
- Supplier verification evidence vault with private storage and time-limited signed document links.
- Customer trust cases and disputes with separate internal notes and customer-visible replies.
- Acquisition analytics and consent-first attribution.
- Account recovery and one-time email verification for customer and supplier accounts.
- RuffNeck Entertainment product showcase alongside the wider marketplace.

## Trust and privacy boundaries

- Do not sell or release customer contact details without disclosure and explicit permission.
- An approved supplier or reviewed document is not a guarantee of stock, product quality, licensing, solvency, delivery or transaction performance.
- Membership does not guarantee enquiry volume, ranking or sales.
- Customer enquiries are not a promise to purchase.
- Staff actions and status changes should remain auditable.
- Payment claims must be verified against the receiving account or provider record, not screenshots.

## RuffNeck Entertainment platforms

- RuffNeck LMS — https://ruffneck-lms.vercel.app/
- RuffNeck Prospector — https://ruffneck-prospector.vercel.app/
- RuffNeck Connect — https://ruffneck-connect.vercel.app/
- RuffNeck Social Hub — https://ruffneck-social-hub.vercel.app/
- Kano Run — https://kano-run.vercel.app/
- Kano Keke — https://kano-keke.vercel.app/
- Calloria — https://calloria.vercel.app/
- RuffNeck Entertainment — https://ruffneck-entertainment.vercel.app/

## Technology and deployment

- Next.js 15, React 19 and TypeScript.
- Supabase server-side database access; RNX objects use the `rnx_` prefix.
- Vercel deployment, root directory `./`, Next.js framework preset.
- Node.js 20.9+ as specified by `package.json`.
- Use `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app` for production canonical URLs.
- Keep Supabase secret/service-role keys and session secrets server-side. Never use a `NEXT_PUBLIC_` prefix for secrets.

## Environment variables

Refer to `.env.example` and `VERCEL_DEPLOYMENT.md`. The application may use:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or the documented legacy service-role fallback)
- `RNX_ADMIN_PASSWORD` (owner recovery only)
- `RNX_ADMIN_SESSION_SECRET`
- `RNX_SUPPLIER_SESSION_SECRET`
- `RNX_CUSTOMER_SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `RESEND_API_KEY`
- `RNX_NOTIFICATION_FROM_EMAIL`
- `CRON_SECRET`
- `RNX_OPERATIONS_NOTIFICATION_EMAIL` (optional)
- `RNX_PAYMENT_INSTRUCTIONS` (optional server-only manual instructions)

Do not paste, commit or expose actual secret values.

## Supabase migrations

RNX migrations are additive and use only `rnx_*` application objects, except narrowly scoped RNX Storage policies. Review the target project and its migration history. Apply only missing migrations, in order: `001_rnx_core.sql` through `013_rnx_email_verification.sql`.

Never rerun completed migrations or alter unrelated RuffNeck Entertainment, Prospector, Social Hub, LMS, CALLORIA or other application objects. Refer to individual migration files and feature guides for exact scope.

## Verification status for v1.8.0

The included focused operations contract test is designed to run with `npm run test:rnx-v180`. It does not prove that production Supabase migrations, environment variables, live email delivery or Vercel deployment are correct. Run the full repository `npm run check` against the complete project and review the Vercel production build before treating this release as deployed.

## Commercial deployment

Review Vercel plan terms for commercial use before monetised production operation. Do not assume a personal-use plan permits commercial marketplace operations.
