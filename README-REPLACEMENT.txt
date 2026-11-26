RUFFNECK EXCHANGE v3.16.0 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the full cumulative project source, not an incremental overlay. The archive is flat and its root contains app/, components/, lib/, public/, scripts/, supabase/, package.json and the other project files directly.

DEPLOYMENT
1. Extract the ZIP.
2. Upload the extracted project-root contents directly into the existing GitHub repository, replacing the previous project files.
3. Commit to the main branch and allow the existing Vercel project to deploy.

SUPABASE
Use the existing RuffNeck Entertainment project. No new migration is required in v3.16.0. Keep migrations 001–032 unchanged. Do not rerun completed migrations.

VERCEL
No environment-variable changes are required. Confirm that the full TypeScript check and Next.js production build succeed in the Vercel deployment log.

NEW IN v3.16.0
Suppliers can download their own catalogue as CSV, filtered by moderation status. Export is authenticated, supplier-scoped, excludes customer contact details and private image paths, and supports up to 10,000 rows per download.
