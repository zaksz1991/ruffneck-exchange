# Build status — RuffNeck Exchange v3.14.0

- Source baseline: complete cumulative v3.13.1 project archive.
- Upgrade: first-response SLA tracking for RNX trust cases.
- New migration: `supabase/migrations/032_rnx_trust_case_response_sla.sql`.
- SLA targets: critical 60 minutes; high 240 minutes; normal 480 minutes; low 1,440 minutes.
- Targets are elapsed time from case submission. Only the first customer-visible RNX staff message counts.
- Added automatic database deadline calculation, severity-change recalculation before the first public response, first-response timestamp capture, and a case-history event.
- Existing cases are backfilled using available message history, creation time and current severity. This reconstruction does not claim a previous SLA policy existed.
- Admin trust queue: SLA counters, urgency sorting, response-state filters and per-case deadline/response details.
- Summary counters cover the latest 150 cases loaded by the queue.
- Database: requires migrations 001–031 followed by 032. No new Vercel environment variables or cron job.
- Regression checks: 35 scripts passed, 0 failed.
- TypeScript syntax transpilation: 3 changed TypeScript/TSX files passed. Full project semantic typecheck and Next.js production build could not be run because npm dependency installation failed with registry DNS error `EAI_AGAIN`. Confirm full typecheck and build in Vercel.
