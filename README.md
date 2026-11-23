# RuffNeck Exchange (RNX) — v2.0.0

**Products. Services. Businesses. Opportunities.**

RuffNeck Exchange is a Nigeria-first, multi-industry business-to-business marketplace and sourcing intermediary. It helps customers describe what they need and connects suitable enquiries with reviewed suppliers, manufacturers, wholesalers, distributors, service providers and commercial partners. The platform is designed to expand across locations and markets without being tied to one industry.

Production: https://ruffneck-exchange.vercel.app/  
Repository: https://github.com/zaksz1991/ruffneck-exchange  
Canonical domain: `https://ruffneck-exchange.vercel.app`

## v2.0.0 — Listing-specific enquiry workflow

- Every public offer now opens a free enquiry form tied to that exact approved listing.
- The request page verifies the listing against the live approved catalogue before showing its title and supplier context.
- The form preselects the request type, category and supported state, and inserts an editable request summary.
- The server rechecks that both the listing and supplier remain approved; client-submitted supplier names or IDs are never trusted.
- The lead record stores the listing foreign key plus title, slug and supplier-name snapshots so operations retain context if the public listing later changes.
- The private customer tracker and authorised operations queue show the original offer reference. The reference does not confirm stock, pricing, acceptance or authorise supplier contact.
- Adds additive RNX migration 014. No new environment variable or payment integration is required.

## v1.9.0 — Marketplace discovery upgrade (retained)

- Adds marketplace filters for offer type: product, service, wholesale and rental.
- Adds pricing filters: fixed price, starting price and price on request.
- Adds sorting by newest, oldest and offer name A–Z.
- Applies listing-type and pricing filters in the Supabase query before fetching the bounded catalogue result set.
- Retains the search phrase, category, state and active filters when browsing category and state links.
- Adds a live result count, active-filter summary and clear-filter route.
- Keeps the free sourcing request path visible when the current search produces no approved offer.
- Retains the v1.8.0 operations error diagnostics, safer empty-marketplace state, category/state request prefill and the type-safe request-state allow-list repair.

No database migration or new environment variable is required. Existing approved catalogue fields are reused. Price sorting is intentionally not offered because comparing nominal amounts across different currencies without conversion would be misleading.

## How RNX operates

1. Customers browse categories or submit a free sourcing request.
2. RNX reviews and qualifies the requirement.
3. Staff use category, location and requirement evidence to identify suitable approved suppliers. Supplier participation is voluntary.
4. The supplier receives an anonymised opportunity brief and accepts or declines the agreed terms.
5. Any supplier introduction fee is independently verified against the receiving account record. RNX does not treat a screenshot or a supplier-submitted claim as proof of payment.
6. The customer separately approves or declines the proposed introduction.
7. Customer contact details are released only after the required supplier acceptance, payment verification and customer permission have been recorded.

Customers can submit requests without paying RNX. Supplier memberships, promoted listings, advertising and qualified introductions are services of RuffNeck Knowledge Hub's RNX marketplace operation. Purchases of third-party goods and services are arranged and paid for directly with the relevant supplier. **Automated payment-gateway checkout is not active in this release; applicable RNX fees still use manual payment verification.**

## Platform features

- Multi-industry department and state discovery, approved supplier profiles and separately moderated product/service listings.
- Marketplace search by keyword and state, now extended with offer-type, pricing-type and sort controls.
- Customer sourcing requests linked to the specific published offers customers enquire about, private guest tracking links, optional customer accounts and customer-to-operations messages.
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

This release adds `supabase/migrations/014_rnx_listing_enquiry_context.sql`. Confirm migrations 001–013 are already applied, then apply migration 014 once. Do not rerun completed migrations. For earlier releases, apply only missing RNX migrations in numerical order. Do not alter unrelated RuffNeck Entertainment, Prospector, Social Hub, LMS, CALLORIA or other application objects.

## Verification boundary

The packaged static regression suite includes account recovery, email verification, supplier form/listing controls, v1.8 operations, v1.9 marketplace search and v2.0 listing-specific enquiries. These source-contract tests passed during packaging. TypeScript syntax transpilation passed for the eight changed TS/TSX files. A full semantic TypeScript check and Next.js production build were not completed because project dependencies could not be installed: the npm registry request failed with a DNS `EAI_AGAIN` error. Static checks do not prove live Supabase migration/query behaviour or a successful Vercel build; verify both after installing dependencies and deploying the release.

## Commercial deployment

Review Vercel plan terms for commercial use before monetised production operation. Do not assume a personal-use plan permits commercial marketplace operations.
