RUFFNECK EXCHANGE v3.16.1 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the full cumulative project source, not an incremental overlay. The archive is flat and its root contains app/, components/, lib/, public/, scripts/, supabase/, package.json and the other project files directly.

DEPLOYMENT
1. Extract the ZIP.
2. Upload the extracted project-root contents directly into the existing GitHub repository, replacing the previous project files.
3. Commit to the main branch and allow the existing Vercel project to deploy.

SUPABASE
Use the existing RuffNeck Entertainment project. No new migration is required in v3.16.1. Keep migrations 001–032 unchanged. Do not rerun completed migrations.

VERCEL
No environment-variable changes are required. Confirm that the full TypeScript check and Next.js production build succeed in the Vercel deployment log.

REPAIRED IN v3.16.1
The supplier catalogue CSV export now normalises dynamic Supabase query results before mapping rows, fixing the Vercel TypeScript build error. All v3.16.0 export safeguards and features are retained.
