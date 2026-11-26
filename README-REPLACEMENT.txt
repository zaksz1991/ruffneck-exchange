RUFFNECK EXCHANGE v3.13.1 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the complete cumulative project source, not an incremental overlay.

DEPLOYMENT
1. Extract the ZIP.
2. Open the included `ruffneck exchange` folder.
3. Replace the contents of the existing GitHub repository with the complete contents of that folder.
4. Commit to the `main` branch and allow the existing Vercel project to deploy.

SUPABASE
Use the existing RuffNeck Entertainment project. No new migration is required in v3.13.1. Keep migrations 001–031 unchanged. Do not rerun completed migrations.

VERCEL
No environment-variable changes are required. Confirm that the full TypeScript check and Next.js production build succeed in the Vercel deployment log.

This release fixes the legacy trust-case tracking fallback type error in `app/api/track/[token]/route.ts`.
