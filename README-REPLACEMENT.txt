RUFFNECK EXCHANGE v1.2.0 — FULL REPLACEMENT

1. Download and extract the ZIP.
2. Open the extracted ruffneck-exchange folder.
3. Replace the contents of the existing GitHub repository zaksz1991/ruffneck-exchange with the contents of that folder. Preserve all folders and dotfiles. Do not upload the outer ZIP folder as an extra nested directory.
4. Commit the replacement to the existing main branch.
5. Keep the existing Vercel project, production domain and Root Directory ./ .
6. Confirm migrations 001–009 are already applied, then apply only supabase/migrations/010_rnx_trust_cases.sql. Do not rerun completed migrations.
7. Keep existing server-side Supabase credentials, staff session secrets, supplier/customer session secrets, optional Resend credentials and CRON_SECRET. No new environment variables are required.
8. After Vercel reports Ready, test a request tracking link: submit a test complaint, sign in to RNX Operations, open /admin/trust, assign and triage the case, post an internal note and a customer-visible reply, then confirm the customer tracking page shows only the customer-visible reply.

This is a complete cumulative repository replacement, not a patch. The new v1.2.0 feature is customer complaint/dispute intake and staff resolution handling. Migration 010 creates only RNX trust-case tables and sequence. The assistant did not commit to GitHub, execute Supabase migrations or deploy to Vercel. Full dependency-backed typecheck and production build remain unverified because dependency installation did not complete in the build environment.
