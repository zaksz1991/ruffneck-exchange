# RuffNeck Exchange v3.14.0 — Trust-case first-response SLA monitoring

## Upgrade

RNX Operations now has first-response service-level tracking in the Trust, complaints and resolution console.

The elapsed-time first public response targets are:

| Case severity | First public response target |
| --- | ---: |
| Critical | 60 minutes |
| High | 240 minutes (4 hours) |
| Normal | 480 minutes (8 hours) |
| Low | 1,440 minutes (24 hours) |

The target starts when the customer submits the case. A target is recalculated when staff change severity before the first public response has been recorded.

Only the first customer-visible message sent by RNX staff satisfies the target. Internal notes, customer messages and supplier responses do not count. The database records the first public staff-response timestamp and adds a case event with the target, due time and whether the target was met.

The Operations queue now shows overdue cases, cases due within one hour, on-time first responses and late/unanswered cases. Staff can filter the queue by these states. Case cards are sorted by response urgency, and the detail workspace shows the target, deadline and actual first public response.

Existing cases are backfilled from their creation timestamp, current severity and any existing first customer-visible staff message. The backfill is a reconstruction using the new policy; it does not claim that a historical SLA policy was previously in effect.

## Deployment

- Supabase project: RuffNeck Entertainment (`ruffneck-entertainment`).
- Apply `supabase/migrations/032_rnx_trust_case_response_sla.sql` after migrations 001–031.
- No new Vercel environment variables.
- No cron job or external service is required.
- Deploy the complete project to the existing Vercel project and `main` branch.

## Important interpretation

These are internal elapsed-time monitoring targets, not published customer guarantees, business-hour calculations, regulatory response deadlines or case-resolution deadlines. They do not establish fault, legal liability or a guaranteed outcome. The Operations queue currently loads the latest 150 cases; its summary counts apply to those loaded cases.
