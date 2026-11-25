# RuffNeck Exchange v3.7.0 — Private Commercial Quotation Attachments

## New functionality

- Customers and introduced suppliers can attach one file to a message in an existing commercial quotation conversation.
- Accepted formats: PDF, JPEG, PNG and WebP. Maximum file size: 4 MB per file, with up to 20 attachments per quotation.
- The sender may include an optional note of up to 1,000 characters. The other participant receives the existing generic in-app message notification.
- Conversation messages show attachment name and size. Either participant can open a protected download endpoint from the conversation history.

## Privacy and security

- The Supabase Storage bucket `rnx-commercial-quote-attachments` is private and is provisioned/configured automatically when the first valid attachment is uploaded.
- File signatures are checked on the server; the browser's declared MIME type is not the sole validation source. SVG, HTML, archives, office macro files and other formats are not accepted.
- Message-list JSON exposes file metadata only and does not include raw storage paths. Downloads require the signed customer or approved supplier session for the quotation and use a 5-minute signed URL.
- Upload endpoints re-check quote ownership, the recorded customer/supplier pair, verified introduction payment, supplier acceptance, customer approval, contact release, quote validity/status and transaction outcome. The database attachment RPC delegates to the existing v3.6.0 message RPC so the same database-level controls are applied.
- Message and attachment metadata are written in one database transaction. If the RPC rejects the upload or fails before the database commit, the application removes the uploaded object; an ambiguous transport failure is checked against the metadata table before cleanup.
- The file contents are not copied into email or in-app notifications. RNX does not perform malware scanning; users should share only quotation-relevant material and must not upload passwords, payment credentials or sensitive identity documents.

## Database and configuration

- New migration: `supabase/migrations/027_rnx_commercial_quote_attachments.sql`.
- Apply after migrations 001–026 in the existing RuffNeck Entertainment Supabase project.
- No new Vercel environment variables, third-party services or payment integrations are required.
- The 4 MB file limit keeps multipart upload requests below the standard Vercel Function request-body limit without requiring a beta large-request-body setting.

## Verification boundary

- Static regression checks cover the private metadata table, service-role-only database access, MIME/size checks, authenticated upload/download routes, signed-link issuance, participant scoping and conversation UI.
- TypeScript syntax transpilation and all cumulative static regression scripts are recorded in `BUILD_STATUS.md`.
- Full TypeScript semantic typechecking, Next.js production build, live Supabase migration and real Storage upload/download must be confirmed after deployment.
