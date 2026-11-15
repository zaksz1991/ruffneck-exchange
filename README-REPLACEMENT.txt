RUFFNECK EXCHANGE v1.1.0 — FULL REPLACEMENT

1. Download and extract the ZIP.
2. Open the extracted ruffneck-exchange folder.
3. Replace the contents of the existing GitHub repository zaksz1991/ruffneck-exchange with the contents of that folder. Preserve all folders and dotfiles. Do not upload the outer ZIP folder as an extra nested directory.
4. Commit the replacement to the existing main branch.
5. Keep the existing Vercel project, production domain and Root Directory ./ .
6. Confirm migrations 001–008 are already applied, then apply only supabase/migrations/009_rnx_staff_access_control.sql. Do not rerun completed migrations.
7. Keep the existing server-side Supabase credentials and owner recovery secrets. RNX_ADMIN_EMAIL is optional. Never expose server secrets with a NEXT_PUBLIC_ prefix.
8. Once deployed, sign in using the existing owner recovery password, open /admin/staff, invite a test staff account, accept the invite in a separate private browser session, and verify the role-specific access before issuing real staff accounts.

This is a complete repository replacement, not a patch. It includes the v1.0.1 correction for the TypeScript error reported in the supplied Vercel log and the v1.1.0 staff access control upgrade. The assistant did not commit to GitHub, run migration 009 against Supabase or deploy to Vercel. Syntax and configuration checks passed; a dependency-backed production build and live staff-account tests remain unverified.
