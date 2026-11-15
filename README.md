# RuffNeck Exchange (RNX) — v1.0.0

A multi-industry, multi-location customer-acquisition marketplace connecting customers with products, services, suppliers, businesses, wholesale providers and procurement opportunities. Refrigeration, cold rooms and solar remain categories only; they do not define the brand.

## Core model
RNX receives a customer's sourcing request, verifies the requirement and permission, shares an anonymised opportunity with suitable approved suppliers, records supplier acceptance and payment, then obtains the customer's authorisation before contact details are released. Customer browsing and requests are free. This release implements supplier memberships and manually qualified opportunity fees. Promoted placement is a possible future revenue stream, not a feature currently offered by this release.

Never sell or release customer contact information without disclosure and permission. Membership does not guarantee leads or ranking. Supplier approval is not a guarantee of stock, licence, product condition, delivery or transaction performance.

## v1.0.0 features
- Optional, consent-first first-touch attribution for customer requests and supplier applications.
- Server-enforced analytics consent using an HttpOnly cookie; no attribution when the visitor declines or does not choose.
- Campaign, source, medium, referrer-host and landing-path recording with no IP address, user-agent, full referrer URL or clickstream.
- Private acquisition analytics dashboard at `/admin/analytics`, with 7/30/90/365-day reporting.
- Aggregate source, campaign, category, state, daily trend, verified lead-fee and introduction reporting.
- Aggregate CSV export without customer or supplier personal details.
- New additive migration 008; no non-RNX database tables are modified.

## v0.9.0 features
- Reliable notification outbox worker with atomic database claims and short processing leases.
- Immediate Resend attempts when configured, plus protected daily retries for due pending/failed messages.
- Stable per-notification Resend idempotency keys, bounded retry/backoff and a five-attempt ceiling.
- Manual queue processing in the administrator communications console.
- No customer email is marked delivered; `sent` means the provider accepted the API request.
- Adds migration 007, which alters only `rnx_notifications` and adds a service-role-only claim function.

## v0.8.0 features
- Explainable supplier matching recommendations in the private operations offer workflow.
- Ranks approved suppliers and approved catalogue listings by category, location, request type and keywords.
- Displays match reasons and catalogue evidence; excludes suppliers already offered the same request.
- Manual review and supplier selection remain mandatory; recommendations do not create offers or contact suppliers.
- No additional database migration required; uses existing RNX migrations 001–006.

## v0.7.0 features
- Customer accounts with scrypt password hashes and signed HttpOnly sessions.
- Guest request tracking links; customers can follow status and message RNX without creating an account.
- Customer account dashboard for requests submitted while signed in.
- Private customer-to-operations message threads and administrator reply console.
- Notification outbox with optional Resend email delivery; pending/failed states are visible to operations.

## v0.6.0 features
- Responsive multi-industry marketplace, supplier directory and approved catalogue.
- Customer sourcing request and supplier application forms.
- Individual approved supplier and listing pages.
- Private operations console at `/admin/login`.
- Supplier and listing moderation, plus lead qualification.
- Supplier opportunity offers with anonymised summaries and agreed fees.
- Supplier portal acceptance or decline of assigned anonymised opportunities.
- Manual payment verification using the independently confirmed receiving-account amount, currency and transaction reference against the exact agreed quotation.
- Expiring, unguessable customer consent links; only a hash is stored in Supabase.
- Customer approve/decline page that does not expose the customer's personal information.
- Atomic database checks preventing contact release unless supplier payment is verified and the customer has approved.
- Offer event history and operator audit records.
- Supplier portal sign-in with scrypt password hashes, signed HTTP-only sessions and persistent login throttling.
- Existing approved suppliers can receive one-time portal activation links from operations; links are hashed in the database and expire after seven days.
- Private supplier dashboard for catalogue status, memberships and assigned anonymised opportunities.
- Suppliers can submit additional product/service listings within their active plan's listing limit.
- Three plan tiers: Starter (free), Growth (quotation) and Enterprise (custom quotation). No unverified paid prices are published.
- Manual membership quotation, supplier transaction-reference submission and operations payment verification.
- Paid membership activates only after operations independently records the actual received amount, currency and receiving-account reference and the database confirms they match the quotation; supplier-submitted references do not activate access.
- Private operations membership console at `/admin/memberships`.
- Public plan comparison at `/plans`.

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
- `RNX_SUPPLIER_SESSION_SECRET` (recommended separate random value, at least 32 characters; falls back to the admin secret if omitted)
- `RNX_CUSTOMER_SESSION_SECRET` (recommended separate random value, at least 32 characters; falls back to the admin secret if omitted)
- `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL`, and `CRON_SECRET` for transactional email delivery and the protected daily worker; `RNX_OPERATIONS_NOTIFICATION_EMAIL` is optional
- `RNX_PAYMENT_INSTRUCTIONS` (optional server-only instructions, shown only to signed-in suppliers after a quote)

Never commit actual secrets or expose them through `NEXT_PUBLIC_` variables.

## Database migrations
The RNX schema is additive and uses `rnx_*` tables. Review target project contents and migration history before applying. Apply only migrations not already run, in order:

1. `001_rnx_core.sql`
2. `002_rnx_catalogue.sql`
3. `003_rnx_admin_operations.sql`
4. `004_rnx_introduction_workflow.sql`
5. `005_rnx_supplier_memberships_portal.sql`
6. `006_rnx_customer_accounts_tracking_messaging.sql`
7. `007_rnx_notification_delivery_worker.sql`
8. `008_rnx_consent_first_attribution.sql`

For an installation where migrations 001–007 are already applied, apply only migration 008. For an installation where migrations 001–006 are already applied, apply missing migrations 007 and 008 in order. For a fresh RNX installation, apply 001–008 in order. Check the actual migration history and apply only missing files in numerical order. Do not rerun earlier migrations unnecessarily. Do not modify existing non-RNX RuffNeck Entertainment tables.

## Supplier introduction operating sequence
1. Qualify the customer request in the operations console.
2. Create a supplier offer using an anonymised brief. Do not include the customer's name, email, phone number or other identifying information.
3. Assign the anonymised opportunity and proposed fee to the approved supplier. The supplier sees it in the private portal and explicitly accepts or declines. Staff may separately confirm supplier commercial terms through the agreed business channel; supplier-facing opportunity briefs are not automatically delivered by this release.
4. Verify the exact fee against the bank or payment-provider transaction record. Record the transaction reference and exact amount. A transfer screenshot or verbal claim is not proof.
5. Send the customer approval link privately through the customer's preferred channel. The link expires after seven days and can be regenerated before the customer decides.
6. Customer can approve or decline the specific supplier introduction. Declining does not incur a customer fee.
7. Only after supplier acceptance, verified payment and customer approval may staff share the customer's contact information with that supplier. Record the release after it actually happens.

The database functions enforce supplier acceptance before lead-fee payment verification, exact fee matching, and both paid status plus customer approval before contact release. Membership payments also require an independently recorded receipt amount, currency and receiving-account reference to match the quotation before paid access is activated. The application can attempt transactional email through Resend when valid credentials and a verified sender are configured. Without Resend credentials and a verified sender, notifications remain queued. The worker retries transient failures up to five total attempts, and the admin console can process due notifications manually. WhatsApp and SMS delivery are not implemented. `sent` means the provider accepted the API call, not that inbox delivery was confirmed. Staff still send the anonymised supplier brief and customer consent link manually using approved channels.

## Vercel
- Framework: Next.js
- Root Directory: `./`
- Build: `npm run build`
- Production URL: `https://ruffneck-exchange.vercel.app/`

A connected Git repository does not prove that a deployment build succeeds. Inspect the Vercel deployment build log after committing.

## Supplier membership workflow
1. A new supplier sets a portal password during business application. The password is stored as a scrypt hash, not plain text.
2. RNX reviews and approves the supplier. Approved applications with a password hash are automatically enabled for portal sign-in and receive the free Starter plan.
3. Older approved suppliers who predate portal passwords can be issued a one-time activation link from `/admin/memberships`. The operator sends the link privately to the approved business email; it expires after seven days.
4. Signed-in suppliers can see their approved business record, catalogue submissions, membership status and assigned anonymised opportunities. Customer name, phone, email and original request details are withheld until the contact-release timestamp has been recorded.
5. Starter is free and supports up to 3 catalogue submissions. Growth supports up to 25; Enterprise up to 500. These are configured product limits, not verified market benchmarks. Paid prices are quotation-based and are not invented or prefilled.
6. A supplier requests a paid plan; RNX issues the amount, interval and expiry; the supplier submits a transaction reference; operations checks the real bank/payment-provider record and verifies it. Only then is the paid membership activated.

## Not included
- Payment gateway or automatic bank reconciliation.
- WhatsApp or SMS delivery.
- Customer email verification, password reset and account recovery.
- General website traffic, page-view, ad-impression or clickstream analytics; v1.0.0 measures only consented form conversions.
- Inventory synchronisation, automated supplier outreach and external inventory synchronisation, multi-user staff roles, supplier password reset, independent supplier identity/KYB checks, and promoted-placement controls.

The operations console is a single-password operator gate. Use a strong unique password, restrict Vercel project access and keep all secrets server-side. Vercel Hobby is not assumed to grant a commercial-use entitlement; check the plan terms before monetised production.


See `RNX_CUSTOMER_ACCOUNTS_AND_TRACKING.md` for migration 006, privacy boundaries and optional Resend configuration. See `RNX_SUPPLIER_MATCHING_ENGINE.md` for the v0.8.0 recommendation rules and limitations.


See `RNX_NOTIFICATION_DELIVERY.md` for migration 007, retry policy, Vercel schedule and Resend setup. See `RNX_ANALYTICS_AND_ATTRIBUTION.md` for migration 008, consent controls and analytics reporting.
