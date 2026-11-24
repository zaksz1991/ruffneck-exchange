RUFFNECK EXCHANGE v2.8.0 — COMPLETE REPLACEMENT APPLY INSTRUCTIONS

1. Extract the complete ZIP.
2. Open the `ruffneck exchange` folder.
3. Replace the existing repository contents with the complete contents of this folder.
4. Commit to the `main` branch.
5. Allow the connected Vercel project to deploy. Keep Root Directory `./`.

Supabase project: RuffNeck Entertainment. Confirm migrations 001–019 are already applied, then apply only migration 020: `supabase/migrations/020_rnx_customer_notification_centre.sql`. Do not rerun previous migrations.

No new Vercel environment variable is required. The existing Resend settings remain necessary only for separately opted-in email alerts; in-app notifications are stored in Supabase and displayed in the customer dashboard.
