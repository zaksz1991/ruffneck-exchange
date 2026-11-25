RUFFNECK EXCHANGE v3.10.0 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the complete cumulative RuffNeck Exchange source project, not an incremental overlay. It is based on v3.9.1 and includes the v3.10.0 quotation revision-history upgrade.

DEPLOYMENT
1. Extract this ZIP.
2. Open the included `ruffneck exchange` folder.
3. Replace the contents of the existing GitHub repository with the full contents of that folder.
4. Commit to the main branch and let the existing Vercel project deploy.

SUPABASE
Existing project: RuffNeck Entertainment.
No new migration is required. Keep migrations 001–028 unchanged. Do not rerun them.

NEW IN v3.10.0 — COMMERCIAL QUOTATION REVISION HISTORY
Customer and supplier dashboards display linked versions of a revised quote, compare recorded fields, show same-currency price deltas and warn when currencies change. The customer revision instruction remains visible alongside the resulting revision.

No new Vercel environment variables, third-party services, storage buckets or payment integrations are required.
Full TypeScript typechecking and the Next.js production build must be confirmed by Vercel after deployment.
