RUFFNECK EXCHANGE v1.0.0 — FULL REPLACEMENT

1. Download and extract the ZIP.
2. Open the extracted ruffneck-exchange folder.
3. Replace the contents of the existing GitHub repository zaksz1991/ruffneck-exchange with the contents of that folder. Preserve all folders and dotfiles. Do not upload the outer ZIP folder as an extra nested directory.
4. Commit the replacement to the existing main branch.
5. Keep the existing Vercel project, production domain and Root Directory ./ .
6. In Supabase SQL Editor, check the existing RNX migration history. If 001–007 have already run, apply only supabase/migrations/008_rnx_consent_first_attribution.sql. If earlier migrations are missing, apply only the missing migration files in numerical order. Do not rerun successful migrations.
7. No new environment variable is required for v1.0.0. Existing server-side Supabase credentials remain required.
8. After deployment, sign in to /admin and open Acquisition analytics. Test the site using both Reject optional analytics and Allow optional analytics, then submit a test form with a UTM-tagged link. Only the consented test submission should have attribution.

This is a complete repository replacement, not a patch. The package has not been deployed to GitHub or Vercel by the assistant. Full production build and live database verification remain outstanding.
