# RuffNeck Exchange v3.10.0 — Commercial Quotation Revision History

## New functionality

- Customer and supplier dashboards now show a linked quotation revision timeline for sourcing requests that have revised proposals.
- Each version displays its quote reference, submission date, status, amount/currency and validity date.
- The comparison identifies changes to the quotation title, amount/currency, scope/specifications, delivery terms, estimated fulfilment and validity.
- Same-currency price changes show the amount and percentage increase/decrease. Currency changes are flagged and are not converted or ranked.
- The original customer revision instruction is displayed alongside the resulting version, with the original quote retained as a separate record.
- The history is built from the existing `revision_of_quote_id` relationship and is available to the already-authorised customer and supplier participants.
- The panel is responsive and collapsed by default to keep existing dashboards compact.

## Trust and commercial boundaries

- The view compares recorded quotation data; it does not decide which party is correct or whether a change is commercially acceptable.
- A customer revision request, a revised proposal or a customer preference is not a payment, purchase order, binding contract, completed transaction or RNX guarantee.
- RNX does not convert currencies, process supplier-customer commercial payments or guarantee quotation accuracy or fulfilment.
- No new customer, supplier or staff data is exposed. Existing dashboard API access controls remain the source of quote visibility.

## Database and deployment

- No new Supabase migration. The component uses the existing quotation revision links and fields from migration 028.
- Keep the existing RuffNeck Entertainment Supabase project and migrations 001–028 unchanged.
- No new Vercel environment variables, storage buckets or third-party services.

## Verification boundary

- Adds a v3.10.0 static regression test for revision-chain rendering, change comparisons, currency warnings and both dashboard integrations.
- The cumulative static regression scripts and TypeScript/TSX syntax transpilation are included in release validation.
- Full TypeScript semantic typechecking, Next.js production build and live browser workflow must still be confirmed through Vercel and the deployed application.
