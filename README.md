# RuffNeck Exchange (RNX) — v2.6.0

**Products. Services. Businesses. Opportunities.**

RuffNeck Exchange is a Nigeria-first, multi-industry business-to-business marketplace and sourcing intermediary. It helps customers describe what they need and connects suitable enquiries with reviewed suppliers, manufacturers, wholesalers, distributors, service providers and commercial partners. The platform is designed to expand across locations and markets without being tied to one industry.

Production: https://ruffneck-exchange.vercel.app/  
Repository: https://github.com/zaksz1991/ruffneck-exchange  
Canonical domain: `https://ruffneck-exchange.vercel.app`

## v2.6.0 — customer saved-offer comparison

- Signed-in customers can select up to three offers from their saved-offer shortlist and compare them in a side-by-side table.
- Comparison includes supplier, category, listing type, location, displayed price, supplier-reported availability and save date, with links back to each listing and supplier profile.
- The comparison selection is held in the customer dashboard session and is removed automatically when an offer is unsaved or is no longer returned by the saved-offer API.
- The comparison clearly states that availability and pricing are supplier-reported, prices are not converted between currencies, and RNX does not independently verify stock, quality or delivery terms.
- This is a client-side enhancement to the existing private saved-offer data. No new Supabase migration, environment variable, storage bucket or external provider is required.

## v2.5.0 — customer saved offers

- Signed-in customers can save published marketplace listings and review or remove them from their dashboard.
- Saved offers retain supplier, location, price, current supplier-reported availability and listing imagery, while API access remains scoped to the authenticated customer.
- Adds migration 018 for private customer bookmarks, with RLS, browser-role revocation and a trigger that permits only approved listing/supplier records.
- Requires migration 018; apply it after migrations 001–017. v2.6.0 itself adds no additional SQL.

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
- Customer sourcing requests linked to the specific published offers customers enquire about, private guest tracking links, optional customer accounts, customer-to-operations messages and side-by-side comparison of up to three saved offers.
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

The cumulative v2.6.0 project contains RNX migrations 001–018. Migration 018 provides the private customer saved-offer records. v2.6.0 itself adds no migration. For older deployments, apply only missing RNX migrations in numerical order after reviewing the existing Supabase migration history. Never rerun a migration recorded as completed. These migrations create and modify only RNX-prefixed objects; do not alter unrelated RuffNeck Entertainment, Prospector, Social Hub, LMS, CALLORIA or other application objects.

## Verification boundary

All repository static regression scripts, including the v2.6.0 offer-comparison checks, passed in the packaging run. TypeScript/TSX syntax transpilation passed for the updated customer dashboard component. A full semantic TypeScript check and Next.js production build were not run because project dependencies are not installed in this environment. Confirm both through the Vercel deployment build. Static tests do not prove live Supabase or production-browser behaviour; complete the customer comparison smoke test after deployment.

## Commercial deployment

Review Vercel plan terms for commercial use before monetised production operation. Do not assume a personal-use plan permits commercial marketplace operations.
