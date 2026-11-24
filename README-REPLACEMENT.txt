RUFFNECK EXCHANGE v2.3.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete Next.js project source, application routes, API routes, components, libraries, public assets, deployment configuration, documentation, regression tests and Supabase migrations 001–016.

GUI deployment:
1. In the existing RuffNeck Entertainment Supabase project, confirm migrations 001–015 are applied and run `supabase/migrations/016_rnx_listing_gallery.sql` in the Supabase SQL Editor.
2. Extract this ZIP.
3. Open the `ruffneck exchange` folder.
4. Replace the existing GitHub repository contents with the contents of this folder, preserving paths.
5. Commit the changes to the `main` branch.
6. Keep the existing Vercel project, Root Directory `./` and environment variables unchanged.

Do not rerun migrations 001–015.

Read `APPLY-v2.3.0.txt`, `RELEASE-NOTES-v2.3.0.md` and `BUILD_STATUS.md` before deployment.
