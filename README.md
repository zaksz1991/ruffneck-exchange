# RuffNeck Exchange (RNX) — v3.3.0

**Products. Services. Businesses. Opportunities.**

RuffNeck Exchange is a Nigeria-first, multi-industry business-to-business marketplace and sourcing intermediary. It helps customers describe what they need and connects suitable enquiries with reviewed suppliers, manufacturers, wholesalers, distributors, service providers and commercial partners. The platform is designed to expand across locations and markets without being tied to one industry.

Production: https://ruffneck-exchange.vercel.app/  
Repository: https://github.com/zaksz1991/ruffneck-exchange  
Canonical domain: `https://ruffneck-exchange.vercel.app`

## v3.3.0 — commercial quotation oversight

- Adds a private RNX Operations console at `/admin/quotes` for the latest 250 supplier commercial quotations.
- Displays supplier identity, request category and location, proposal amount, scope, delivery terms, validity and event history.
- Supports status filtering, text search and CSV export.
- Access is restricted to owner and operations administrator roles using the existing `operations:read` permission. The endpoint excludes customer names, email addresses and phone numbers.
- The console is read-only; it does not modify supplier quotes or customer decisions. Quoted amounts are proposals, not RNX revenue or proof of completed transactions.
- No database migration or new environment variable is required. Migration 024 must already be applied.

## v3.2.0 — supplier commercial quotations

- Adds structured supplier commercial proposals after the RNX introduction has passed supplier acceptance, payment verification, customer approval and contact release.
- Customers can review scope, total price, currency, delivery terms and quote validity in their account dashboard; they can mark one proposal as preferred or decline it.
- Supplier withdrawals, customer decisions, quote expiry and private event history are recorded. Customers receive an in-app quote notification; suppliers receive a configured email when their proposal is marked preferred.
- The supplier quote is separate from the RNX introduction fee. Customer selection is preference only, not payment, an order, a binding contract or RNX guarantee.
- Adds migration 024. Apply after migrations 001–023 have succeeded.

## v3.1.0 — verified transaction outcomes and supplier reviews

- After a paid, customer-approved introduction is contact-released, the customer and matched supplier independently confirm whether the transaction completed.
- Matching completion confirmations unlock a verified review. Matching non-completion confirmations mark the introduction cancelled; conflicting confirmations create an operations follow-up item and do not unlock reviews.
- Customers with account-linked requests can submit one 1–5 star review. Reviews remain private until an authorised RNX trust staff member approves publication.
- Public supplier profiles display approved review ratings, written feedback and supplier responses. Suppliers can publish one response to an approved review.
- Outcome confirmation verifies each actor against the customer account or supplier attached to the introduction. A database trigger independently enforces review eligibility.
- Guest-only tracking requests are not eligible for verified reviews in this release. No new environment variable or external service is required.
- Adds migration 023. Apply after migrations 001–022 have succeeded.

## v3.0.0 — supplier listing performance insights

- Suppliers can review per-listing detail-view counts for the last 7 and 30 days, plus aggregate saves and linked enquiries.
- Listing detail-view events are captured only after the visitor accepts optional analytics. The browser records at most one view per listing per tab session.
- View reports are not unique-person counts and exclude visitors who decline analytics. The event table stores listing/supplier references and timestamps only; customer account and contact fields are not included.
- Adds migration 022 with private event storage and a service-role-only aggregate metrics function. Migration 022 does not reference the `availability_status` column.
- No new environment variables or external services are required.

## v2.9.0 — customer request progress timeline

- The signed-in customer dashboard now shows a chronological timeline for each account-linked request.
- Timeline events record request submission, changes to the request's workflow status, and changes to the contact-release permission stage.
- Existing account-linked requests receive a truthful submission milestone; historical status transitions are not fabricated because the older system did not record them.
- Guest requests continue to use their existing private tracking-link flow. The timeline does not expose staff-only notes or supplier contact details.
- Adds migration 021 with a private, customer-scoped activity table and a database trigger. It does not depend on listing availability columns or saved-offer migrations.

## v2.8.0 — customer notification centre

- The customer dashboard includes a private notifications panel for saved-offer updates.
- Active customers who save a public offer see an in-app notification when its published price/price type/currency or supplier-reported availability changes.
- Customers can mark individual notifications or all notifications as read; unread counts are shown in the dashboard.
- In-app notifications are separate from email consent. The v2.7.0 email feature remains opt-in per saved listing and still requires a verified email address.
- Adds migration 020 for private customer notifications and change baselines. Apply it after migrations 001–019. No new Vercel environment variable or external service is required.

## v2.7.0 — saved-offer change alerts

- Customers can explicitly enable or disable email alerts for each saved marketplace offer.
- RNX queues an email when a saved listing's published price, currency/price type or supplier-reported availability changes.
- The current published values are captured when alerts are enabled, so changes made before opt-in are not reported as new changes.
- A price edit made while a listing is paused is detected when the edited listing is approved and republished.
- Alerts are sent only to active customers with a verified email address and an explicit per-listing opt-in.
- Uses the existing RNX email outbox and Resend notification worker. Apply migration 019 after migrations 001–018. No new Vercel environment variable is required; email delivery still depends on the existing Resend configuration.

## v2.5.0 — customer saved offers

- Signed-in customers can save published marketplace listings and review or remove them from their dashboard.
- Saved offers retain supplier, location, price, current supplier-reported availability and listing imagery, while API access remains scoped to the authenticated customer.
- Adds migration 018 for private customer bookmarks, with RLS, browser-role revocation and a trigger that permits only approved listing/supplier records.
- Requires migration 018; apply it after migrations 001–017.

## v2.4.0 — supplier-reported availability

- Suppliers can update availability on approved listings without pausing or resubmitting the listing.
- Public cards, detail pages and marketplace filters use the supplier-reported status and optional note. The status is not independently verified by RNX.
- Adds migration 017 for status, note and last-update timestamp; apply after migrations 001–016.

## v2.3.0 — supplier listing photo galleries

- Suppliers can add up to four extra listing photographs in addition to the existing cover image, and remove photos from the supplier portal.
- Each photo is limited to 4 MB and accepted only when its real file signature matches JPEG, PNG or WebP.
- Extra photos can be changed only while a listing is pending, rejected or paused. Approved listings must first be paused and all changed listing content remains subject to RNX review.
- Approved listing detail pages provide selectable photo thumbnails. Marketplace cards continue to use the cover photo to avoid adding gallery-query cost to discovery pages.
- The private RNX moderation queue previews extra gallery photos alongside the cover image.
- Adds migration 016, private gallery metadata with RLS and revoked browser-role privileges, plus a database trigger enforcing supplier ownership, allowed moderation state and a hard four-photo limit under concurrent uploads.
- Reuses the existing private `rnx-listing-images` Storage bucket. No new environment variable or external image service is required.

Apply `supabase/migrations/016_rnx_listing_gallery.sql` in the existing RuffNeck Entertainment Supabase project after confirming RNX migrations 001–015 are already applied.

## v2.2.1 — Vercel TypeScript build correction

- Fixes the TypeScript error caused by calling `.catch()` on the Supabase query builder's `PromiseLike<void>` result in the listing-image audit path.
- Uses awaited audit insertion with local error handling so audit failure does not misreport a successful image upload.
- No database migration or environment-variable change.

## v2.2.2 — supplier listing audit correction

- Removes unsupported native `.catch()` chaining from both audit insert paths in the supplier listing update/status API.
- Keeps audit writes awaited and best-effort so successful listing changes are not reported as failed when audit logging is unavailable.
- No database migration or environment-variable change.

## v2.2.0 — supplier listing cover images

- Suppliers can add or replace one cover image when submitting or editing a listing.
- Accepts JPEG, PNG and WebP files up to 4 MB; the server checks the actual file signature rather than trusting browser MIME metadata.
- Supplier image updates require ownership and an editable listing state. Approved listings must be paused before their image can change, and all listing edits still return to RNX moderation.
- Images are stored in a private Supabase Storage bucket. Public listing cards and details receive short-lived signed image URLs only after both the listing and supplier pass the existing approval checks; RNX reviewers can preview images in the moderation queue.
- Listings without an image retain a branded fallback. No new environment variable or external image provider is required.
- Adds RNX migration 015 for the listing image path and restrictive Storage access policy. The private bucket is provisioned by the server on first upload.

## v2.1.0 — Supplier catalogue editing and re-review

- Suppliers can edit their own pending, rejected and paused catalogue listings from the private supplier portal.
- Editing a listing resubmits it as `pending`; the listing stays hidden until RNX reviews and approves the updated offer.
- An approved public listing must first be paused before it can be edited, preventing live public content from changing without moderation.
- The API scopes every lookup and update to the authenticated supplier account, uses the existing status as a compare-and-set guard and records supplier actions in the RNX audit log.
- Suppliers can correct rejected listings and either edit paused listings or resubmit them unchanged.
- No database migration, new environment variable, external provider or payment integration is required.

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

- Multi-industry department and state discovery, approved supplier profiles and separately moderated product/service listings with supplier-submitted cover images.
- Marketplace search by keyword and state, now extended with offer-type, pricing-type and sort controls.
- Customer sourcing requests linked to the specific published offers customers enquire about, private guest tracking links, optional customer accounts, customer-to-operations messages and side-by-side comparison of up to three saved offers, with optional email alerts when saved offers change their published price or supplier-reported availability.
- Staff operations console with role-based access, supplier/listing moderation, lead qualification and audit records.
- Supplier matching recommendations for staff review; recommendations do not automatically create offers or disclose customer details.
- Supplier portal with private anonymised opportunities, accept/decline decisions, catalogue controls and membership operations.
- Manual introduction-fee and membership-payment verification, customer consent links and database-enforced contact-release checks.
- Supplier verification evidence vault with private storage and time-limited signed document links.
- Customer trust cases and disputes with separate internal notes and customer-visible replies.
- Consent-based acquisition attribution and privacy-limited supplier listing insights (consented listing-detail views, aggregate saves and linked enquiries).
- Verified supplier feedback based on dual-confirmed transaction completion, with RNX moderation and supplier responses.
- Private supplier commercial quotations after authorised introductions, customer preference selection, withdrawal/expiry history, in-app customer alerts and configured supplier email notifications.
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

The cumulative v3.2.0 project contains RNX migrations 001–024. Migration 018 provides private customer saved-offer records; migration 019 adds opt-in saved-offer price and availability email alerts; migration 020 adds private in-app customer notifications. For older deployments, apply only missing RNX migrations in numerical order after reviewing the existing Supabase migration history. Never rerun a migration recorded as completed. These migrations create and modify only RNX-prefixed objects; do not alter unrelated RuffNeck Entertainment, Prospector, Social Hub, LMS, CALLORIA or other application objects. For the previously encountered missing `availability_status` error, see `docs/SUPABASE_MIGRATION_RECOVERY.md` and the included idempotent repair script under `supabase/repairs/`.

## Verification boundary

The cumulative static regression scripts, including the v3.2.0 commercial quote checks, are retained in the project. Full semantic TypeScript checking and the Next.js production build require installed project dependencies. Static tests do not prove live Supabase RPC behaviour; apply migration 024 and confirm the Vercel build before enabling the new workflow.

## Commercial deployment

Review Vercel plan terms for commercial use before monetised production operation. Do not assume a personal-use plan permits commercial marketplace operations.
