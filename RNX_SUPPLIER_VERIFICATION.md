# RNX supplier verification — v1.3.0

## Purpose

This is a separate, optional business-evidence review for suppliers already approved for public representation. The original supplier application approval remains separate from this documentary verification.

## Supplier workflow

1. A signed-in, approved supplier opens the Business verification section of `/supplier/dashboard`.
2. The supplier saves a declaration with business structure, registered name, registration number where applicable, country, operating state, website and a statement of authority/business activity.
3. The supplier uploads evidence. Accepted formats are PDF, JPEG, PNG and WebP. The server checks the file signature and declared MIME type; the maximum is 4 MB per file and 10 files per submission.
4. Required evidence depends on the selected structure:
   - Registered business: business registration and proof of address.
   - Sole trader: evidence of business operations and proof of address.
   - Licensed provider: business registration, operating licence and proof of address.
5. The supplier submits the draft. Documents become locked to that submission while it is under review.
6. If rejected, the supplier receives a public explanation and can create a new submission.

## Private evidence storage

- Bucket: `rnx-supplier-verification`, created or normalised through the Supabase Storage API on first supplier/admin verification load.
- Bucket visibility: private.
- A bucket-specific restrictive policy on `storage.objects` prevents browser roles from accessing this bucket even if another app has broad permissive Storage policies.
- File bytes are uploaded and read only through server routes using the server-side Supabase secret.
- Routes verify the signed supplier session and supplier ID, or the staff verification permission, before accessing an object.
- Viewing links expire after five minutes and must not be copied into public pages, email campaigns or support notes.
- The database stores metadata and a private object path; it does not expose storage paths through supplier APIs.
- The accepted MIME types are application/pdf, image/jpeg, image/png and image/webp. Server validation checks PDF/JPEG/PNG/WebP file signatures before upload.

## Staff workflow

- Workspace: `/admin/verification`.
- Only Owner and Operations Administrator roles have `verification:read` and `verification:write` permissions.
- Staff can open a submission, create temporary document-viewing links, accept/reject individual documents and add document review notes.
- A submission cannot be approved unless all required evidence categories are accepted.
- Approval requires an expiry date in the future and no more than two years away.
- Rejection requires a supplier-visible explanation. Staff-only internal notes remain separate.
- Every decision is written to `rnx_supplier_verification_events` and staff activity history.

## Public badge

An “RNX document reviewed” badge appears on the approved supplier directory/profile only when the supplier's verification status is `verified` and the verification expiry timestamp is still in the future. The badge deliberately does not say “certified” or imply regulatory endorsement.

## Migration

Apply `011_rnx_supplier_verification.sql` only after confirming migrations 001–010 are present. It adds three RNX tables, adds three verification fields to `rnx_supplier_applications`, enables RLS, revokes direct browser access, grants service-role access and provisions the private Storage bucket. It does not edit non-RNX objects.

## Limitations

- Staff review is manual. RNX does not query CAC, FIRS, professional councils or other regulators automatically.
- No automated licence validation, biometric checks, sanctions screening, solvency checks or legal opinion is provided.
- The public badge means the submitted business evidence was reviewed by RNX within the stated validity period. It is not a guarantee that a document is genuine unless authenticity has been independently established; it does not guarantee product quality, stock, price, delivery, solvency or future compliance.
- RNX should publish a privacy/retention schedule and obtain appropriate consent before collecting identity or tax-related documents. Collect only evidence required for a clear business-verification purpose.
- Staff must not download, circulate or retain evidence outside the controlled process. Use synthetic test files during acceptance testing.
- A failed Storage upload must not be represented as a submitted document. A migration must be applied before this feature is enabled.
