# RuffNeck Exchange v3.5.0 — Customer Commercial Quotation Comparison

## New functionality

- Customers can select up to three supplier commercial quotations for comparison within one sourcing request.
- The comparison shows supplier, quote reference, title, amount and currency, scope/specification, delivery/payment terms, estimated fulfilment, validity and current status.
- Customers can remove individual quotations or clear the comparison.
- Comparison selections are kept separate for each sourcing request and are pruned when a quote is no longer submitted or selected.
- Different currencies are never silently converted or numerically ranked. The comparison displays the submitted amounts and explicitly warns customers when currencies differ.
- The comparison is a decision-support view only. It does not select a quotation, create an order, initiate payment, validate supplier claims or change quote status.

## Database and configuration

- No Supabase migration is required; existing v3.2/v3.4 quotation and customer introduction data are reused.
- No new Vercel environment variables, external services or payment integrations are introduced.
- Existing Supabase project remains RuffNeck Entertainment. Migrations 001–025 remain unchanged.

## Verification boundary

- Static regression coverage checks request-scoped comparison, three-quote cap, supported comparison fields, currency warning and mobile layout.
- Full TypeScript semantic typechecking and the Next.js production build must be confirmed in Vercel after deployment.
- Live customer account comparison should be tested with at least two supplier quotations attached to the same sourcing request.
