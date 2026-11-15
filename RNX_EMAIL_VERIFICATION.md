# RNX email verification — operations and safety

## User flow

### Customer
1. Customer registers with name, email, phone and password.
2. RNX stores the account as unverified and sends a one-time link.
3. The customer opens `/account/verify-email` from the email.
4. The database consumes the token and stamps `rnx_customers.email_verified_at`.
5. The customer signs in; the server issues a session only after the email timestamp exists.

### Supplier
1. Supplier submits the existing business application and optional first listing.
2. RNX stores the application as pending and sends a business-email confirmation link.
3. The applicant confirms the email address.
4. RNX Operations completes the existing business verification/review process.
5. A new approval transition is rejected by the database if email confirmation has not occurred.
6. Supplier portal access still requires an approved application and `portal_enabled = true`.

Email confirmation does not approve suppliers, authenticate company registration, validate licences or guarantee that offers are genuine.

## Resend behaviour
Customer and supplier sign-in forms have a resend action after valid credentials are entered for an unverified account. The supplier application form also offers resend after a successful submission. The public resend API always returns generic wording and does not reveal whether an email is registered.

## Token and storage controls
- Token material is 256 bits of cryptographic randomness.
- Only a SHA-256 token hash is stored in `rnx_email_verification_tokens`.
- Token lifetime is 60 minutes.
- Tokens are single-use, consumed under a row lock, and earlier links for that account are invalidated on reissue.
- Email and IP rate-limit keys are HMACs; raw email and IP strings are not written to the rate-limit table.
- The token table and rate-limit table have RLS enabled and deny browser roles. Only the server-side service role can access them.
- The email body is sent directly through Resend, not through the general operations notification outbox.

## Vercel environment variables
Keep existing values:
- `RESEND_API_KEY`
- `RNX_NOTIFICATION_FROM_EMAIL` (must be a verified sender in Resend)
- `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`
- `RNX_ADMIN_SESSION_SECRET` or the existing account-specific session secret

Optional new independent secret:
- `RNX_EMAIL_VERIFICATION_SECRET` — random secret, minimum 32 characters. When absent, the helper falls back to `RNX_ACCOUNT_RECOVERY_SECRET`, then `RNX_ADMIN_SESSION_SECRET`.

Do not put secrets in `NEXT_PUBLIC_*`, source files, GitHub commits or customer-visible content.

## Existing account handling
Migration 013 leaves existing customer and supplier email timestamps NULL. Those users must confirm their email once using the resend path. Existing approved suppliers remain approved; the trigger only blocks a new transition into `approved` while the email remains unconfirmed.

## Deployment acceptance checks
1. Run `npm run test:account-recovery`.
2. Run `npm run test:email-verification`.
3. Run `npm run typecheck` and `npm run build` from the complete repository with installed dependencies.
4. Confirm migrations 001–011, migration 012 and migration 013 are recorded as applied, in sequence.
5. Register a controlled customer account. Confirm no session is issued before email confirmation. Confirm the link, sign in, then confirm a second use of the same link is rejected.
6. Submit a controlled supplier application. Confirm the email link, verify that approval can proceed only after confirmation, then test the supplier portal login after approval and portal enablement.
7. Test expired links, resend throttling, wrong account type, duplicate email and Resend failure handling.

Do not call this feature live until the actual production browser, database and Resend tests are completed.
