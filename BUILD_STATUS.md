# v3.8.0 build and validation status

- Source base: complete cumulative RuffNeck Exchange v3.7.0 project archive.
- Version: 3.8.0.
- Added authenticated, print-ready commercial quotation documents for customers and suppliers.
- Complete project archive: 332 files, including 27 Supabase migrations and 27 regression scripts.
- New Supabase migration: none. Existing migrations 001–027 remain unchanged.
- No new Vercel environment variables, storage buckets, payment integrations or third-party services.

## Validation completed in this workspace

- All 27 cumulative static regression scripts: passed.
- TypeScript/TSX syntax transpilation: 177 implementation files checked; zero syntax diagnostics. Ambient declaration files are excluded from this syntax-only count.
- v3.8.0 regression test covers participant-specific ownership, introduction payment/acceptance/approval/contact-release gates, active customer and supplier state, non-indexable document metadata, exclusion of contact/credential fields, quotation contents, disclaimer, print action, print CSS and dashboard links.
- ZIP structure and archive integrity: checked before packaging.

## Not verified in this workspace

- Full TypeScript semantic typecheck; project dependencies are not installed in this workspace.
- Next.js production build.
- Live Supabase/customer/supplier session access with production data.
- Browser print output and Save-as-PDF rendering across desktop and mobile browsers.

The document pages use the existing customer and supplier signed-session cookies and the existing server-only Supabase credentials. The shared loader refreshes quotation expiry and rechecks the quote owner, linked lead and introduction, customer account status, supplier approval/portal status, supplier acceptance, RNX-verified payment, customer approval and contact-release timestamp. Vercel must confirm the full production build after deployment.

Test with a non-production customer and supplier pair whose introduction has passed all existing release gates. Confirm each participant can open the quote document, an unrelated account cannot open it, and the browser's print dialog offers Save as PDF. This release is a document view only; it does not generate or digitally sign a PDF on the server.
