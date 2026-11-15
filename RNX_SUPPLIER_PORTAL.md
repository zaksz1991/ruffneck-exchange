# RNX Supplier Portal — v0.6.0

## Access
New applicants choose a portal password during business registration. The application stores a salted scrypt hash only. Portal access is enabled when RNX approves the supplier. Suppliers must use `/supplier/login`; the protected dashboard is `/supplier/dashboard`.

Approved supplier records created before v0.6.0 may not have a password. An administrator can open `/admin/memberships`, generate a one-time activation link for the approved supplier and send it privately to the business email on record. The raw token is not stored; only its SHA-256 hash is saved. The link expires after seven days and may be replaced by generating a fresh one.

## Capabilities
- View the supplier's own approved business application record.
- Submit additional product, service, wholesale or rental listings within the current membership listing cap. Every new listing is pending until separately approved.
- View membership status and requests.
- Request Growth or Enterprise membership terms.
- View RNX-issued quotation and optional payment instructions, then submit a transaction reference. A reference remains pending until RNX verifies funds actually received, enters the confirmed amount/currency and records the receiving-account transaction reference.
- View only the supplier's own opportunity offers and accept or decline an offer before the process advances. Customer identity, phone, email and original request details are redacted until the contact-release timestamp has been recorded.

## Membership levels
- Starter: free, up to 3 catalogue submissions.
- Growth: up to 25 catalogue submissions, quotation required.
- Enterprise: up to 500 catalogue submissions, custom quotation.

These plan limits are product settings, not market-research claims. Paid prices are not pre-filled. They must be quoted by RNX and agreed before payment. Membership does not guarantee enquiries, leads, sales, ranking or placement. A lead fee, where separately agreed, is distinct from membership.

## Payment operations
The portal does not charge cards or collect funds. A supplier submits a reference and RNX operations must check the receiving bank/payment-provider account. The operator must enter the amount, currency and bank/provider reference independently confirmed in the receiving account. The database compares the independently recorded amount and currency with the active quotation before activating the plan. A screenshot or unverified reference is not payment confirmation. Only operations can mark the membership payment verified and activate the paid plan.

## Security notes
- Portal passwords are stored as scrypt hashes.
- Sessions are signed, HTTP-only, SameSite=Lax cookies with a seven-day lifetime. Set a 32+ character `RNX_SUPPLIER_SESSION_SECRET`; the system falls back to `RNX_ADMIN_SESSION_SECRET` only for convenience.
- Login attempts are persistently throttled using a keyed digest of email and network source, rather than storing raw IP addresses.
- Supplier API reads are scoped to the authenticated supplier application ID.
- Supabase RLS is enabled and browser roles have no direct access to RNX private tables. Server-only Supabase credentials are required.
- Legacy supplier activation URLs and customer consent URLs must be sent privately; never post them publicly.

## Manual steps still required
No email, WhatsApp, SMS or payment provider is connected. RNX staff must send activation links and payment instructions manually using verified channels. No automated password reset is included; a new access link must be issued by an administrator.
