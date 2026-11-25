RUFFNECK EXCHANGE v3.7.0 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the complete cumulative RuffNeck Exchange source project, not an incremental overlay.

DEPLOYMENT
1. Extract this ZIP.
2. Open the included `ruffneck exchange` folder.
3. Replace the contents of the existing GitHub repository with the full contents of that folder.
4. Commit to the main branch and let the existing Vercel project deploy.

SUPABASE
Existing project: RuffNeck Entertainment.
Confirm migrations 001–026 are applied, then apply only supabase/migrations/027_rnx_commercial_quote_attachments.sql.
Do not rerun migrations 001–026.

NEW IN v3.7.0 — PRIVATE QUOTATION ATTACHMENTS
Customers and introduced suppliers can attach PDF, JPEG, PNG or WebP files to private commercial quotation conversations. Files are limited to 4 MB each, up to 20 files per quotation. Storage is private and downloads require the participant's signed-in session and a short-lived signed link.

No new Vercel environment variables, third-party services or payment integrations are required.
Full TypeScript typechecking and the Next.js production build must be confirmed by Vercel after deployment.
