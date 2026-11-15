# RNX v0.9.0 — Notification delivery worker

## What changed
- Notifications continue to be written to `rnx_notifications` before sending.
- Configured Resend delivery is attempted immediately after queue insertion.
- A protected daily worker processes pending messages and due transient failures.
- Operations can manually process up to 10 due messages from `/admin/communications`.
- Database claim leases and `FOR UPDATE SKIP LOCKED` prevent two workers from claiming the same row at the same time.
- Resend `Idempotency-Key` is stable per notification ID to reduce duplicate messages after ambiguous timeouts or retries.
- Transient failures use bounded backoff (5 minutes, 30 minutes, 2 hours, 12 hours) and a maximum of five total attempts.
- Permanent HTTP errors stop automatic retries. Operator review is required.

## Required migration
Apply `supabase/migrations/007_rnx_notification_delivery_worker.sql` once after migrations 001–006. It modifies only `public.rnx_notifications` and adds a service-role-only function. It does not modify LMS, Prospector, Social Hub, products, billing or other non-RNX tables.

## Required Vercel environment variables
- `CRON_SECRET`: a random secret at least 24 characters long. Store only in Vercel Production (and Preview if you need to test the protected route there). Do not commit it or send it in chat.
- `RESEND_API_KEY`: Resend API key.
- `RNX_NOTIFICATION_FROM_EMAIL`: a sender address/domain verified with Resend.

Existing variables remain required: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or the supported legacy service-role key), `RNX_ADMIN_PASSWORD`, and `RNX_ADMIN_SESSION_SECRET`.

## Schedule
`vercel.json` registers `GET /api/cron/notifications` once per day at 06:00 UTC (07:00 Nigeria time). Vercel Hobby Cron jobs run once per day with up to ±59 minutes scheduling precision. This schedule is a backlog retry mechanism; newly queued messages still attempt immediate delivery when email provider credentials are configured. The administrator can manually process the queue at any time.

Vercel sends `Authorization: Bearer <CRON_SECRET>`. The endpoint rejects missing or invalid secrets and checks provider configuration before claiming any rows. The worker processes at most 10 messages per run with concurrency capped at three.

## Retry semantics
- New queue rows start as `pending`.
- A claimed row enters `processing` with a two-minute lease; its attempt count increments atomically.
- Successful provider API acceptance sets `sent`. This is not a confirmation that the recipient's inbox accepted/delivered the message.
- Transient transport errors, HTTP 408/409/425/429 and HTTP 5xx are retryable.
- Other provider 4xx responses are treated as permanent and stop automatic retries.
- Maximum: five total attempts. Retry delays after transient failures are 5 minutes, 30 minutes, 2 hours and 12 hours.
- Expired worker leases are recovered by a later run. Resend idempotency keys use `rnx-notification-<notification UUID>`; Resend documents a 24-hour retention window, so it is not a guarantee against duplicates outside that window.
- An operator can review status, attempt count, next retry, failure code and last error in the outbox.

## Test sequence
1. Apply migration 007.
2. Add the environment variables in Vercel; use a verified sender domain in Resend.
3. Redeploy the project so the cron configuration registers.
4. From `/admin/communications`, use **Process email queue** with a known pending test notification.
5. Check the outbox status and provider dashboard. Do not use a real customer's address for initial testing.
6. Confirm `GET /api/cron/notifications` returns 401 without the bearer secret and succeeds with the secret when provider variables and database migration are present.
7. Check Vercel Function Logs for the daily production invocation.

## Explicit limits
- WhatsApp and SMS remain unimplemented.
- The worker does not guarantee inbox placement; Resend acceptance is not the same as delivered status.
- There is no Resend webhook event reconciliation in this version.
- Vercel cron scheduling is daily on Hobby. Do not interpret this as instant retry. Manual processing is available in Operations.
- Do not configure a sender address that has not been verified by the email provider.
