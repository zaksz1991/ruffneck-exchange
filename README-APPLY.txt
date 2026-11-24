RUFFNECK EXCHANGE v2.9.0 — COMPLETE REPLACEMENT APPLY INSTRUCTIONS

1. Extract the complete ZIP.
2. Open the `ruffneck exchange` folder.
3. Replace the existing repository contents with the complete contents of this folder.
4. Commit to the `main` branch.
5. Allow the connected Vercel project to deploy. Keep Root Directory `./`.

Supabase project: RuffNeck Entertainment. Confirm RNX migrations 001–020 are applied, then apply only migration 021:
supabase/migrations/021_rnx_customer_request_activity_timeline.sql

If the earlier v2.8.0 migration failed because `public.rnx_listings.availability_status` was missing, run `supabase/repairs/repair_rnx_listing_availability_prerequisite.sql` and then re-run only the failed migrations 019 and 020. See `docs/SUPABASE_MIGRATION_RECOVERY.md`. Migration 021 does not depend on listing availability columns.

No new environment variables are required.
