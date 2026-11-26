# RuffNeck Exchange v3.16.0 — Supplier Catalogue CSV Export

## What changed

- Added an authenticated supplier-only catalogue export endpoint at `GET /api/supplier/listings/export`.
- Suppliers can export all listings or filter by approved, pending, paused or rejected status.
- CSV snapshots contain listing details, moderation state, availability information, slug and creation/update timestamps.
- CSV output is UTF-8 with a BOM and CRLF row endings for spreadsheet compatibility.
- Spreadsheet formula-like values are neutralised before export.
- Exports are scoped to the current authenticated supplier and capped at 10,000 records per download.
- Private image-storage paths, customer identities and customer contact details are excluded.
- No database migration or new environment variable is required.

The export is a reporting/backup snapshot, not an import template. It does not modify catalogue records, moderation status or availability.

## Validation

- 38 cumulative regression scripts passed.
- TypeScript/TSX syntax transpilation passed for 191 files.
- Full TypeScript semantic typecheck and Next.js production build were not verified because dependency installation timed out in the development environment. Confirm both in the Vercel deployment log.
