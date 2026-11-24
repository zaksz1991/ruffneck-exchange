# RNX Supabase migration recovery

## Missing `rnx_listings.availability_status`

Migrations 019 and 020 compare supplier-reported listing availability. If Supabase returns an error stating that `public.rnx_listings.availability_status` does not exist, the availability prerequisite from migration 017 is missing or incomplete.

1. Open the existing RuffNeck Entertainment Supabase project.
2. Run `supabase/repairs/repair_rnx_listing_availability_prerequisite.sql` in the SQL Editor.
3. Confirm the query at the end returns all three columns: `availability_status`, `availability_note` and `availability_updated_at`.
4. Re-run the full migration 019 if it did not complete successfully.
5. Re-run the full migration 020 if it did not complete successfully.
6. Apply migration 021 only after the earlier required migrations are complete.

The repair uses `ADD COLUMN IF NOT EXISTS`, checks for its named constraints and index, and is safe to repeat. It must not be used as a reason to drop or recreate any RNX table.

## Migration discipline

- Inspect the Supabase migration history before applying SQL.
- Apply only migrations that have not completed successfully.
- Do not rerun migrations 001–018 merely to repair a later migration.
- Never delete production customer, supplier, lead, listing, message, notification or payment records to resolve a schema error.
- Migration 021 is separate from listing availability; it records customer request status and contact-release milestones.
