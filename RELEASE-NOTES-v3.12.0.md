# RuffNeck Exchange v3.12.0 — Customer Protection Evidence Vault

## New functionality

- Customers can attach relevant records to an open complaint or dispute from their private request-tracking link.
- A supplier can add supporting records only after RNX has explicitly requested a response and while the case is in `awaiting_supplier`.
- Authorised RNX Operations staff can upload either customer-visible evidence or internal-only evidence.
- Customer and supplier evidence is shared with the customer, the assigned supplier where applicable, and authorised RNX staff. Internal staff evidence is visible only to authorised staff.
- The customer tracking view, supplier response centre and RNX Operations case workspace display the files that each party is permitted to see.
- Each case supports up to 20 evidence files. Each file may be a PDF, JPEG, PNG or WebP up to 4 MB.
- Downloads are served through a private Supabase Storage bucket using 5-minute signed links issued only after checking the tracking token, supplier assignment or RNX staff permission.
- File metadata and evidence-upload events are recorded in the trust-case event history. The database RPC writes the metadata and event in one transaction.

## Privacy and controls

- Storage bucket: `rnx-trust-case-evidence`; private, created/configured automatically by the first successful server upload.
- Browser clients have no direct table or Storage access. Metadata access uses the server-side Supabase service client; all download links are short-lived.
- Server checks file signatures for PDF, JPEG, PNG and WebP. The submitted MIME type must match the detected file type when the browser supplies one.
- Customer uploads require a valid high-entropy request tracking token and a case belonging to that request. Customers cannot upload new evidence to resolved or closed cases.
- Supplier uploads require an active approved supplier session, exact supplier ownership, an RNX response request and the `awaiting_supplier` case status.
- Staff upload and download routes enforce `trust:write` and `trust:read` permissions respectively. Staff-only evidence is filtered out of customer and supplier APIs.
- The system does not scan files for malware. Users should only upload relevant case records and must not upload passwords, bank credentials, payment-card data or unnecessary full identity-document numbers.
- Files record what a party submitted; upload does not independently verify authenticity, establish liability or determine a dispute outcome.

## Database and deployment

- New migration: `supabase/migrations/030_rnx_trust_case_evidence_vault.sql`.
- Apply after migrations 001–029 in the existing RuffNeck Entertainment Supabase project.
- No new Vercel environment variables, external services or separate Storage SQL policies are required. The table is service-role-only and the private bucket is managed through the Supabase Storage API.

## Verification boundary

- Adds a static regression script for storage privacy, uploader ownership, file validation, staff visibility controls, signed downloads and the three user interfaces.
- Static regression checks and TypeScript/TSX syntax transpilation are checked in the release workspace.
- Full TypeScript semantic typechecking, Next.js production build and live customer/supplier/staff upload and download must still be confirmed in Vercel and the deployed Supabase project.
