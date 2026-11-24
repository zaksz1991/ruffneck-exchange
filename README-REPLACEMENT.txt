RUFFNECK EXCHANGE v2.2.0 — COMPLETE CUMULATIVE REPLACEMENT

This archive contains the complete Next.js project source: application routes, APIs, components, libraries, public assets, documentation, regression tests and Supabase migrations 001–015.

GUI deployment:
1. Extract this ZIP.
2. Open the ruffneck exchange folder.
3. Replace the existing GitHub repository contents with the contents of this folder, preserving paths.
4. Commit the changes to the main branch.
5. Keep the existing Vercel project and Root Directory ./.

Required database step: confirm migrations 001–014 are already applied, then apply only migration 015_rnx_listing_images.sql. Never rerun a migration that has already succeeded. No new Vercel environment variable is required.

Read APPLY-v2.2.0.txt, RELEASE-NOTES-v2.2.0.md and BUILD_STATUS.md before deployment.
