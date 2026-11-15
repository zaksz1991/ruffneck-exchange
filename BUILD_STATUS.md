# Build and release status — v0.6.0

## Included
- Complete cumulative application from v0.5.0.
- Supplier portal login, signed HTTP-only session, salted scrypt password hashes and persistent sign-in throttling.
- One-time claim links for approved legacy suppliers without portal credentials.
- Supplier dashboard for memberships, listings, assigned offers, supplier accept/decline decisions and privacy-gated customer contact release.
- Supplier catalogue submission subject to the active plan listing limit.
- Starter, Growth and Enterprise membership plan catalogue.
- Membership payment verification requires operations to enter the actual received amount, currency and bank/provider reference after checking the receiving account. The database compares the independently recorded receipt with the quote before activation. No card processor or payment gateway is connected.
- Private membership operations console and audit events.
- Public supplier plan comparison page.

## Required setup
- Vercel Root Directory remains `./`; framework remains Next.js.
- Keep `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`.
- Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RNX_ADMIN_PASSWORD`, `RNX_ADMIN_SESSION_SECRET`.
- Recommended: configure a separate `RNX_SUPPLIER_SESSION_SECRET` of at least 32 characters. It falls back to `RNX_ADMIN_SESSION_SECRET` if omitted.
- Optional: configure `RNX_PAYMENT_INSTRUCTIONS` with verified payment instructions. Keep it server-only. Do not put real bank details in the repository.
- Apply migration `005_rnx_supplier_memberships_portal.sql` only after confirming migrations 001–004 are applied.

## Verification status
- Project files were extended from the existing v0.5.0 source and bundled as a complete replacement.
- Static TypeScript validation passed using temporary lightweight module declarations because project dependencies could not be installed; this is not a full dependency-backed typecheck.
- No production database migration has been executed.
- No dependency installation or full Next.js production build has been verified in this environment.
- No live login, supplier invite, payment, or contact-release workflow has been tested against the production Supabase project.
- Payment recording is manual only. A supplier-submitted transaction reference is not proof of payment. RNX operations must verify actual funds received.
- No payment gateway, email, SMS or WhatsApp provider is connected. Activation and customer consent links must be delivered manually through verified channels.
- Contact information is returned to the supplier dashboard only when `contact_released_at` has been set by the RNX contact-release workflow.

Do not describe this release as production-tested until dependency installation, production build, migration execution and controlled end-to-end tests have passed.
