# RuffNeck Exchange v3.13.0 — Customer Resolution Review and Appeals

## New functionality

- Customers using their private request tracking link can request one review of a resolved or closed trust case within 14 days of the published resolution.
- The customer must explain why the outcome should be reconsidered (20–2,000 characters). The tracking token is revalidated and the case must belong to the same request.
- RNX Operations receives an email-outbox notification when a review is requested, when the optional operations notification email is configured.
- The Operations trust-case queue highlights appeals awaiting review and provides a dedicated appeals filter.
- Staff with `trust:write` can accept an appeal and reopen the case to `under_review`, or not uphold the appeal and retain the existing case status. Both decisions require a customer-visible response.
- Customers see the submitted appeal, review status and final staff response in the private tracking page. Customer email notifications use the existing notification outbox and do not expose the private tracking link.
- One appeal is allowed per case. The database records the original terminal status and resolution timestamp, the customer's reason, the decision, reviewer and customer-visible response.

## Controls and boundaries

- The 14-day deadline is checked in a service-role-only database function against `resolution_published_at`; browser clocks are not authoritative.
- Resolution timestamps are backfilled for existing resolved/closed cases. New resolution timestamps are maintained by a database trigger.
- Appeal submission and appeal review use security-definer database functions that lock the case/appeal rows and write the corresponding case event in the same transaction.
- The appeal table has RLS enabled and direct access revoked from `public`, `anon` and `authenticated`. Only the server-side service role can read or mutate it.
- Customer submission is authorised by the existing high-entropy tracking token and verifies the case belongs to the lead. Staff review requires an authenticated staff session and `trust:write`.
- Accepting an appeal reopens the case for further RNX review. It is not an admission of fault or a finding of fraud, contractual breach or legal liability. Not upholding an appeal leaves the recorded operational outcome in place.
- A review request does not create a refund, reverse a payment, compel a supplier, or create a contract.

## Database and deployment

- New migration: `supabase/migrations/031_rnx_trust_case_resolution_appeals.sql`.
- Apply migration 031 in the existing RuffNeck Entertainment Supabase project after confirming migrations 001–030 have succeeded.
- No new Vercel environment variables, external services or Storage buckets are required. Optional Operations and customer emails use the existing notification outbox.

## Verification boundary

- Adds a static regression script covering the database functions, deadline enforcement, tracking-token ownership check, staff permissions, notifications and customer/Operations interfaces.
- Static regression checks and TypeScript/TSX syntax transpilation are checked in the release workspace.
- Full TypeScript semantic typechecking, Next.js production build and live customer/staff appeal workflow still require Vercel and deployed Supabase verification.
