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
RNX uses only `rnx_*` tables. Confirm the target project and migration history before applying anything. Apply only missing migrations in numerical order: 001 core, 002 catalogue, 003 admin operations, 004 consent-based introductions, 005 supplier memberships and portal, and 006 customer accounts, tracking, messaging and notifications. Do not rerun a migration that has already been applied successfully. These migrations are additive to RNX objects and do not modify RuffNeck Entertainment LMS, Social Hub, billing, product, profile or Prospector tables.

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


## v0.7.0 customer portal and notification variables
Add `RNX_CUSTOMER_SESSION_SECRET` (at least 32 random characters; a dedicated secret is recommended). It falls back to `RNX_ADMIN_SESSION_SECRET` if omitted.

Optional email delivery uses Resend: `RESEND_API_KEY`, `RNX_NOTIFICATION_FROM_EMAIL` (a sender verified by Resend), and `RNX_OPERATIONS_NOTIFICATION_EMAIL`. Without a valid provider key and sender, notification rows stay pending in the database. Do not describe them as delivered. WhatsApp and SMS are not implemented.

Apply `006_rnx_customer_accounts_tracking_messaging.sql` only after confirming migrations 001–005 are present. Customer registration, login, guest tracking, messaging and operations replies all require migration 006.

## v0.7.0 release checks
After deployment, test account registration, customer sign-in, request submission while signed in, guest tracking-link access, customer message submission, administrator replies and privacy boundaries. Confirm that the supplier portal cannot retrieve customer message threads. If Resend is configured, verify a real receipt and sender-domain authentication; otherwise verify the outbox correctly shows pending/failed rather than delivered.
