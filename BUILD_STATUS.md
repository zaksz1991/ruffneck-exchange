# Build status — RuffNeck Exchange v1.3.0

## New capability

Supplier verification and a private evidence vault. Approved suppliers can submit a business declaration and supporting documents from the private supplier portal. Owner and Operations Administrator staff can inspect short-lived private evidence links, review individual documents, add internal notes, send supplier-visible feedback and approve verification with a fixed expiry. A public “RNX document reviewed” badge appears only while the recorded approval remains unexpired.

## New files and routes

- `supabase/migrations/011_rnx_supplier_verification.sql`
- `RNX_SUPPLIER_VERIFICATION.md`
- `components/supplier-verification-panel.tsx`
- `components/admin-verification-console.tsx`
- `app/admin/verification/page.tsx`
- `app/api/supplier/verification/route.ts`
- `app/api/supplier/verification/documents/route.ts`
- `app/api/supplier/verification/submit/route.ts`
- `app/api/admin/supplier-verifications/route.ts`
- `app/api/admin/supplier-verifications/[id]/route.ts`
- `lib/verification-storage.ts`

## Security controls in code

- Supplier routes require an active supplier portal session and bind every query to the authenticated supplier ID.
- Evidence types are restricted to PDF, JPEG, PNG and WebP; the server checks file signatures and MIME type.
- Upload ceiling is 4 MB per file and 10 files per verification request.
- Supabase Storage bucket is private. The migration adds a restrictive bucket-specific policy blocking browser roles, and server routes use the existing server-only Supabase secret key.
- Supplier and staff viewing links expire after five minutes.
- Internal verification notes and staff events are not returned to the supplier API response.
- Only Owner and Operations Administrator roles receive the verification read/write permissions.
- Approval requires all evidence categories for the selected business structure to be accepted and a future expiry date within two years.
- Supplier approval and documentary review remain separate statuses.

## Database impact

Migration 011 depends on migrations 001–010. It adds only:
- `rnx_supplier_verifications`
- `rnx_supplier_verification_documents`
- `rnx_supplier_verification_events`
- `verification_status`, `verification_expires_at` and `verification_last_reviewed_at` on `rnx_supplier_applications`
- A restrictive Storage policy limited to bucket `rnx-supplier-verification`

No non-RNX business tables are modified. The private evidence bucket is created/normalised through the server-only Storage API.

## Validation performed

- TypeScript/TSX syntax transpilation: 126 files, zero syntax diagnostics.
- Static `tsc --noEmit` with temporary framework shims: passed. This is not a dependency-backed typecheck; the temporary shim files are excluded from the release ZIP.
- JSON configuration parsing: passed.
- SQL scope/security inspection: passed for intended RNX-only table scope and restrictive bucket-specific policy; migration not executed against Supabase.
- ZIP integrity: verified at packaging.
- Dependency installation: attempted with `npm install --prefer-offline --no-audit --no-fund`, but timed out in this environment.
- Full Next.js production build: not verified.
- Production Supabase migration and live evidence workflows: not performed.

## Important limitations

This is a manual documentary review, not automated KYB or regulator verification. The public badge means specified business evidence was reviewed by RNX within the displayed validity period. It does not guarantee authenticity unless independently established, nor inventory, goods, licences, quality, solvency, fulfilment or future compliance. Publish a privacy/retention schedule and obtain appropriate consent before collecting identity or tax-related documents. Collect only what is necessary. Use synthetic evidence during acceptance testing.
