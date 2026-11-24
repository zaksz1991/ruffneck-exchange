# Vercel deployment guide

## Project settings
- Framework: Next.js.
- Root Directory: `./`.
- Build Command: `npm run build` (default Next.js build is also valid).
- Node.js: use the version selected in the Vercel project. Node.js 22 LTS or newer is supported by the package engine declaration.

## Environment variables
Set in Vercel Project Settings → Environment Variables:
- `NEXT_PUBLIC_SITE_URL` = `https://ruffneck-exchange.vercel.app`
- `SUPABASE_URL` = existing approved Supabase project URL
- `SUPABASE_SECRET_KEY` = server-only Supabase secret key

Do not paste secret values into source files, GitHub, browser code or variables prefixed with `NEXT_PUBLIC_`.

## Supabase caution
RNX uses only `rnx_*` tables. Confirm the target project and migration history before applying anything. The current cumulative release contains migrations 001–019: core, catalogue, operations, introductions, supplier memberships/portal, customer accounts/tracking/messaging, notification delivery, consent-first attribution, staff access control, trust cases, supplier verification/private evidence storage, account recovery, email verification, listing-specific enquiry context, private listing cover images, private listing photo galleries, supplier-reported availability and private customer saved listings and customer opt-in saved-offer change alerts. Apply only missing migrations in numerical order; never rerun a migration that has already succeeded. These migrations are additive to RNX objects and do not modify RuffNeck Entertainment LMS, Social Hub, billing, product, profile or Prospector tables.

## Deployment check
1. Confirm a new deployment was created from the latest `main` commit.
2. Wait for `npm run build` to complete and inspect the complete log if it fails.
3. Check homepage, marketplace, request page and business registration page.
4. Submit a test request and confirm the row is stored in `rnx_leads`.
5. Submit a test business application and confirm the row is stored in `rnx_supplier_applications`.
6. Confirm no contact details are exposed on public pages.

A successful Git connection is not proof of a successful build. The message `A repository ID is required for GitHub deployments` is a Vercel Git integration issue, not a Next.js source compilation message.

## v0.6.0 supplier portal variables
Keep the Supabase URL and server secret server-only. Add `RNX_SUPPLIER_SESSION_SECRET` (32+ random characters; a dedicated value is recommended) and optionally `RNX_PAYMENT_INSTRUCTIONS` for the instructions displayed after a supplier receives a membership quotation. Do not put actual bank details in GitHub or in a `NEXT_PUBLIC_` variable. The supplier portal uses the existing `RNX_ADMIN_SESSION_SECRET` as a fallback if a separate supplier session secret is not configured.

## v0.6.0 database
Apply `005_rnx_supplier_memberships_portal.sql` only after confirming migrations 001–004 are applied. It adds RNX-prefixed portal, membership and independently verified payment-evidence structures. It does not change unrelated RuffNeck Entertainment tables. The membership payment verifier requires the actual amount, currency and receiving-account reference entered by operations; the supplier's submitted reference alone cannot activate membership.


## v0.7.0 customer portal and v0.9.0 notification delivery variables
Add `RNX_CUSTOMER_SESSION_SECRET` (at least 32 random characters; a dedicated secret is recommended). It falls back to `RNX_ADMIN_SESSION_SECRET` if omitted.

Email delivery uses Resend: `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL` (a sender verified by Resend), and `RNX_OPERATIONS_NOTIFICATION_EMAIL` (optional). `CRON_SECRET` must be a random server-side value of at least 24 characters to authorize the scheduled notification worker. Without a valid Resender API key and verified sender, notification rows stay pending in the database. WhatsApp and SMS are not implemented.

Apply `006_rnx_customer_accounts_tracking_messaging.sql` only after confirming migrations 001–005 are present. Apply `007_rnx_notification_delivery_worker.sql` only after 001–006 are present. Migration 007 changes only `public.rnx_notifications` and creates the service-role-only claim function. Check the migration history and apply only missing SQL files.

The daily cron is registered in `vercel.json`: `/api/cron/notifications` at 06:00 UTC (07:00 in Nigeria). It is protected by `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby cron runs once a day and is not minute-precise; see `RNX_NOTIFICATION_DELIVERY.md`. The Operations console also has a manual **Process email queue** control.

## v0.7.0 release checks
After deployment, test account registration, customer sign-in, request submission while signed in, guest tracking-link access, customer message submission, administrator replies and privacy boundaries. Confirm that the supplier portal cannot retrieve customer message threads. If Resend is configured, verify a real receipt and sender-domain authentication; otherwise verify the outbox correctly shows pending/failed rather than delivered.


## v0.9.0 notification worker
See `RNX_NOTIFICATION_DELIVERY.md` for worker semantics, attempt limits, backoff schedule and acceptance testing. A database status of `sent` means the Resend API accepted the request; it is not a verified inbox delivery event.


## v1.1.0 staff access deployment

After confirming migrations 001–008 exist, apply `supabase/migrations/009_rnx_staff_access_control.sql`. No new Vercel secret is required. Retain `RNX_ADMIN_PASSWORD` and `RNX_ADMIN_SESSION_SECRET` as server-only owner recovery credentials. `RNX_ADMIN_EMAIL` is optional. Redeploy the project with Root Directory `./`. Test the owner login, create a staff invitation at `/admin/staff`, accept it in a private browser session, and verify that each role can reach only its permitted page and API. Suspend the account and confirm its next protected request is rejected.

## v1.2.0 trust and resolution workflow

Confirm migrations 001–009 are already applied, then apply only `supabase/migrations/010_rnx_trust_cases.sql`. It creates only `rnx_trust_cases`, `rnx_trust_case_messages`, `rnx_trust_case_events` and the RNX case-reference sequence. No new Vercel environment variables are required. Customer case intake is available only from an existing private `/track/<token>` link. After deployment, test case submission, customer-visible replies, staff-only notes, status transition rules, role denial for finance/analyst and customer API filtering of internal notes. Do not use a customer case as proof of supplier fraud or legal liability.


## v1.3.0 supplier verification
Confirm migrations 001–010 are present, then apply only `supabase/migrations/011_rnx_supplier_verification.sql`. This migration creates a private Storage bucket named `rnx-supplier-verification`; it must remain non-public. Do not add any Storage policy granting `anon` or `authenticated` access. Application server routes use the existing `SUPABASE_SECRET_KEY` and verify supplier ownership or the owner/operations-admin verification permission before generating 5-minute signed URLs. No new environment variables are required.

After deployment, test with a non-production supplier account: save a draft, upload a harmless sample PDF/image under 4 MB, confirm it is private and only accessible through the signed supplier session route, submit it, review as owner/operations administrator, accept the required document types, approve with an expiry date, and check the public supplier profile badge. Confirm finance, customer support and analyst roles cannot load `/admin/verification` or its APIs. Never use live personal identity documents for smoke tests. Delete test evidence after validation.


## v2.0.0 listing-specific enquiry context

Confirm migrations 001–013 are applied, then apply only `supabase/migrations/014_rnx_listing_enquiry_context.sql`. It adds a nullable reference from a customer lead to the published catalogue listing that initiated the enquiry, plus historical snapshots of the listing slug, title and supplier business name. RLS and browser-role restrictions remain unchanged. No Vercel environment variable or new provider is required.

Post-deployment checks:
1. Open a currently approved public listing and select **Enquire about this offer — free**.
2. Confirm the request page shows the offer and prepopulates relevant details.
3. Submit a non-production test enquiry and confirm the lead queue identifies the referenced offer.
4. Open the private tracking link and confirm the original offer reference is shown.
5. Pause or reject a test listing and verify a new enquiry submitted from an old page is rejected with a clear message.
6. Confirm supplier-facing screens still do not expose customer contact details before the existing permission and payment gates complete.


## v2.2.1 production build patch

The v2.2.1 release corrects a TypeScript error in the listing-image audit code. Supabase query builders return PromiseLike values, so the audit insert now uses `await` inside `try`/`catch` rather than chaining `.catch()` onto the builder's `.then()` result. This is an application-code patch only: no migration or environment-variable change is required. After replacing the repository contents and deploying, confirm that Vercel completes TypeScript checking and the production build.

## v2.2.0 supplier listing cover images

Confirm migrations 001–014 are already applied, then apply only `supabase/migrations/015_rnx_listing_images.sql`. The migration adds nullable `rnx_listings.image_path` and a restrictive Storage policy preventing browser roles from reading or writing the private `rnx-listing-images` bucket. The bucket is provisioned by the server on first supplier upload. No environment variable is added.

Post-deployment checks:
1. Sign in with a non-production supplier account and create a pending listing with a JPEG, PNG or WebP image under 4 MB.
2. Confirm the supplier portal displays the image thumbnail and a replacement image can be uploaded after editing an eligible listing.
3. Confirm an approved listing must be paused before its image changes.
4. Approve the test listing through RNX operations and confirm the marketplace card and detail page show the photo.
5. Confirm a pending or rejected listing is not visible on public marketplace pages and that anonymous browser access to the private Storage bucket is denied.
6. Confirm an oversized file, SVG, or file with a renamed extension is rejected.

## v2.1.0 supplier catalogue editing

- Suppliers can edit their pending, rejected and paused offers in the supplier portal.
- Approved offers must be paused before editing; saved changes return to `pending` moderation.
- No additional Supabase migration is needed for v2.1.0 itself. The cumulative v2.2.0 release requires migration 015; keep migrations 001–015 applied after applying it.
- Run the repository `check` script and confirm a successful Vercel production build after deployment.


## v2.6.0 saved-offer comparison

The customer dashboard now lets signed-in customers select up to three bookmarked offers and compare supplier, category, listing type, location, published price, supplier-reported availability and saved date. The UI reads the existing `/api/customer/saved-listings` response; comparison selection is client-side only. No Supabase migration or Vercel environment-variable change is required for v2.6.0. The cumulative deployment must already have migration 018 (`rnx_customer_saved_listings`) from v2.5.0.

After deployment, sign in with a test customer account, save at least two currently approved offers, select them for comparison, confirm the comparison table and listing/supplier links, select a third offer, verify a fourth cannot be selected, and remove one saved offer to confirm it is also removed from comparison. Confirm that the disclaimer remains visible and that currencies are not silently converted.


## v2.7.0 saved-offer change alerts

Confirm migrations 001–018 are applied, then apply only `supabase/migrations/019_rnx_saved_listing_change_alerts.sql` in the existing RuffNeck Entertainment Supabase project. It adds explicit per-saved-offer customer preferences and a database trigger that queues an email when a saved listing's published price, currency/price type or supplier-reported availability changes. Customers must have a verified email address. The current listing values are captured when alerts are enabled, so changes made before opt-in are not sent as new alerts. Price edits made while paused are compared when the offer is approved again.

No new environment variables are required. Email delivery reuses the existing `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL` and `CRON_SECRET`. Without the provider configuration, alerts remain pending in `rnx_notifications`. The current Vercel cron processes the queue daily; Operations can also process the queue manually. Customers can turn off alerts at any time in the customer dashboard.


## v2.8.0 customer notification centre

Confirm migrations 001–019 are applied, then apply only `supabase/migrations/020_rnx_customer_notification_centre.sql` in the existing RuffNeck Entertainment project. The migration creates private in-app notifications for active customers who saved a listing when its published price, currency/price type or supplier-reported availability changes. It also adds independent last-seen baselines so existing saved offers do not generate historical alerts on migration.

The customer dashboard displays the latest 60 notifications and the total unread count. Customers can mark one notification or all notifications as read. The API requires an active signed-in customer session; read-state updates are same-origin and customer-scoped. The notification table has RLS enabled and no direct browser-role privileges.

The existing v2.7.0 email flow remains separate: only customers who enable email alerts for that saved offer and have a verified email address enter the email outbox. No new environment variables, external services or cron changes are required for in-app notifications. Test by saving a published listing with a customer account, changing its price or availability as the supplier, completing any required moderation, and checking that customer dashboard.


## v2.9.0 customer request progress timeline

Confirm the prior RNX migrations are applied, then apply only `supabase/migrations/021_rnx_customer_request_activity_timeline.sql` in the existing RuffNeck Entertainment Supabase project. The migration records account-linked request submission, request status changes and contact-release permission changes. It uses only existing RNX customer and lead tables; it does not reference `availability_status`, saved-listing columns or unrelated application tables.

The customer requests API reads events only for the currently authenticated customer and the request IDs returned for that customer. The activity table has RLS enabled and direct browser-role access revoked. Existing account-linked requests receive a submission marker using their original request creation timestamp; old status transitions are not invented. Guest requests continue to use the existing private tracking-link workflow.

After Vercel deploys, sign in with a test customer, open a request in the dashboard, and verify the request-received event. Then change that test request's status in RNX Operations and verify a new timeline event appears after refreshing the customer dashboard. Test a contact-release permission transition separately.


## v3.4.0 supplier commercial quotation notifications

Confirm migrations 001–024 are applied, then apply only `supabase/migrations/025_rnx_supplier_quote_notifications.sql` in the existing RuffNeck Entertainment project. The migration creates a private supplier notification table and a trigger that records notices when a quote becomes selected, not selected, declined or expired. The supplier dashboard reads the latest 40 notifications and unread count; read-state updates are authenticated and scoped to the current supplier.

No new environment variables or external services are required. The supplier notification API does not return customer names, email addresses or phone numbers. Test using a test introduction and quotation: change the quotation status through the customer account, then verify the supplier sees the correct notice and can mark it read.
