# RuffNeck Exchange v2.9.0 — Customer request progress timeline

## What changed

Signed-in customers now see a chronological progress history within each request card in the customer dashboard.

The timeline records:
- Request received by RNX.
- Request workflow status changes (`new`, `qualifying`, `qualified`, `matched`, `closed` or `invalid`).
- Contact-release permission changes (`locked`, `customer_approved` or `released`).

## Privacy and data handling

- Every event is linked to both the request and the owning customer account.
- The API scopes activity queries to the authenticated customer and the request IDs belonging to that customer.
- The activity table has Row Level Security enabled and direct browser-role privileges revoked.
- Staff-only notes, internal moderation explanations and supplier contact details are not copied into the timeline.
- Guest requests continue to use the existing private tracking-token workflow.
- Older requests receive a submission milestone only. Historical workflow transitions are not fabricated.

## Supabase

Apply `supabase/migrations/021_rnx_customer_request_activity_timeline.sql` after confirming migrations 001–020 are applied. The migration does not reference listing availability columns or saved-offer tables.

## Vercel

No new environment variables or external services are required.

## Verification boundary

The included regression test checks the migration, customer-scoped API query and dashboard timeline. A live Supabase migration and the full Next.js production build still require deployment verification.
