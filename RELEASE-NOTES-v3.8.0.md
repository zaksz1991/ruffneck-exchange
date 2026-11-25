# RuffNeck Exchange v3.8.0 — authenticated, print-ready commercial quotation documents

## New functionality

- Customers can open a print-ready document for each commercial quotation from the customer dashboard.
- Suppliers can open the same quotation record from the supplier dashboard.
- The document includes quotation reference, title, status, issue date, validity, proposed amount/currency, scope/specifications, delivery/payment/other terms, fulfilment estimate, recorded customer and supplier names, and sourcing request category/location.
- Layout adapts to mobile screens and prints as an A4 quotation sheet.
- The browser's Print dialog supports the user's native **Save as PDF** option. The application does not create or digitally sign a PDF file on the server.

## Access and privacy

- Customer document pages require the signed customer session and the quote's `customer_id` to match.
- Supplier document pages require the signed supplier session and the quote's `supplier_application_id` to match; the supplier must remain approved with its portal enabled.
- The shared server-only loader rechecks the quote's linked lead and introduction, active customer account, approved supplier account, supplier acceptance, RNX-verified payment, customer approval and contact-release timestamp.
- Document pages are dynamic and carry `noindex`, `nofollow` and `noarchive` metadata.
- Customer/supplier phone numbers, email addresses, passwords, conversation messages and attachment storage paths are not queried or rendered.

## Commercial limitations

The document reproduces the quotation record submitted by the supplier. It is not an invoice, payment receipt, purchase order, contract, proof of fulfilment or guarantee by RNX. Customer selection remains a preference signal only. Parties must independently verify the final scope, quantities, taxes, currency, delivery, payment destination, warranties, returns and contract terms before committing funds.

## Database and configuration

- No new Supabase migration.
- Existing migrations 001–027 remain unchanged.
- No new Vercel environment variables, external services or payment integrations.

## Verification boundary

- Added a static regression test for participant ownership, introduction gates, excluded contact data, private page metadata, quotation fields, PDF-print instructions and dashboard links.
- TypeScript syntax transpilation and the cumulative static regression suite are checked in the release workspace.
- Full TypeScript semantic typechecking, Next.js production build and live two-account access testing still require deployment verification.
