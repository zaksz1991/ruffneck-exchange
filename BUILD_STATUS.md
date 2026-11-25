# v3.7.0 build and validation status

- Source base: complete cumulative v3.6.0 project archive.
- Version: 3.7.0.
- Added private PDF/JPEG/PNG/WebP attachments to customer/supplier commercial quotation conversations.
- New Supabase migration: `027_rnx_commercial_quote_attachments.sql` (requires migrations 001–026).
- Private Supabase Storage bucket: `rnx-commercial-quote-attachments`, automatically created/configured by the first valid upload.
- No new Vercel environment variables, third-party services or payment integrations.
- Complete source project: 325 files, including 27 Supabase migrations.

Validation completed in this workspace:
- 26 cumulative static regression scripts: passed.
- TypeScript/TSX syntax transpilation: 172 implementation files checked; no syntax diagnostics. (`next-env.d.ts` is an ambient declaration and is not included in the transpilation count.)
- Complete cumulative archive structure checked before packaging.

Not verified in this workspace:
- Full TypeScript semantic typecheck; project dependencies are not installed here.
- Next.js production build.
- Live Supabase migration 027 execution, private Storage bucket creation, and real two-party upload/download.

An npm dependency installation attempt could not reach the npm registry (`EAI_AGAIN` DNS failure), so full typechecking and the Next.js production build could not be run here. Vercel must confirm both after deployment.

Deployment sequence: confirm migrations 001–026 have succeeded in the existing RuffNeck Entertainment project; apply only migration 027; deploy the complete project to the existing `main` branch and Vercel project. Follow `APPLY-v3.7.0.txt` for the full test workflow.
