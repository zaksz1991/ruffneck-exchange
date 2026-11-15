RUFFNECK EXCHANGE v0.3.0 — COMPLETE PROJECT REPLACEMENT

This archive contains the complete project source plus the catalogue and approved-supplier release. It is not a patch.

1. Extract the ZIP.
2. Open the extracted `ruffneck-exchange-full` folder.
3. In the existing GitHub repository, replace the application source and configuration files with this full folder structure. Do not create a new GitHub repository or Vercel project.
4. Commit the replacement to the existing `main` branch.
5. Keep Vercel Root Directory set to `./`.
6. Confirm Vercel detects the commit and inspect the build log.

DATABASE:
- If RNX migration 001 has not been applied, apply 001 first and then 002.
- If migration 001 and the four RNX core tables already exist, apply only `002_rnx_catalogue.sql`.
- Do not rerun migrations blindly and do not change non-RNX RuffNeck tables.
- Set SUPABASE_URL and SUPABASE_SECRET_KEY as server-only Vercel environment variables.

PUBLIC VISIBILITY:
- New business applications and listings default to pending.
- A business profile appears only after its application is approved.
- A listing appears only after both the supplier application and listing are approved.
- Use `RNX_CATALOGUE_MODERATION.md` for manual review steps.

LIMITATIONS:
- No supplier login/dashboard, admin UI, payment gateway, image uploads, stock sync or automated matching.
- Full dependency installation, production build, database migration and live form submissions have not been verified in this packaging environment.
