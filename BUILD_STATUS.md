# Build status — RuffNeck Exchange v0.9.0

## Included
- Complete cumulative application based on v0.8.0.
- Database-backed notification outbox claims with `FOR UPDATE SKIP LOCKED`, processing leases and due retry scheduling.
- Immediate Resend send attempt for newly queued notifications when configured.
- Protected daily notification worker at `/api/cron/notifications` using `CRON_SECRET`.
- Manual notification queue processing by signed-in administrators at `/admin/communications`.
- Resend idempotency key per notification, max five attempts and bounded backoff.
- Migration 007 alters only `public.rnx_notifications` and adds a service-role-only function.

## Verification performed
- TypeScript source check with temporary ambient framework declarations: passed (no diagnostics). This is not equivalent to installing dependencies and running the actual Next.js build.
- ZIP integrity and required-file checks: performed by the packaging script.
- JSON configuration parsing: performed by the packaging script.
- SQL structure was inspected for migration order and intended object scope; not executed against the user's Supabase project.
- Full dependency installation, Next.js production build, live Resend request, live Supabase migration, cron invocation and browser acceptance testing have NOT been performed.

## Before deployment
1. Confirm migrations 001–006 exist in the intended Supabase project. Apply only migration 007 once.
2. Configure `CRON_SECRET`, `RESEND_API_KEY`, and `RNX_NOTIFICATION_FROM_EMAIL` as server-side Vercel variables. Use a verified sender.
3. Keep Vercel Root Directory at `./`.
4. Upload the complete project to the existing GitHub repository and commit to `main`.
5. Check the production build log. Test in preview or with an internal test address before customer-facing use.
6. Confirm the daily worker is registered in Vercel Cron Jobs after the production deployment.
