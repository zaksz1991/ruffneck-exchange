# RuffNeck Exchange v3.3.0 — Commercial Quotation Oversight

## New functionality

- Adds a private Operations page at `/admin/quotes` for monitoring supplier commercial quotations.
- Displays the latest 250 quote records with status, supplier business name, request category/location, submitted amount/currency, scope, delivery terms, fulfilment estimate and validity.
- Includes recorded quote event history for submission, customer selection, non-selection, decline, supplier withdrawal and expiry.
- Provides status filtering, text search and CSV export of the visible results.
- Provides operational counts for the loaded record set and explicitly identifies when the latest-250 cap applies.
- Keeps customer email addresses, phone numbers and names out of the oversight endpoint.

## Access and commercial boundaries

- Both page and API require an authenticated RNX administrator with `operations:read` permission. This currently limits access to owner and operations administrator roles under the existing permission map.
- The oversight console is read-only. It cannot edit, approve, select, withdraw or otherwise change a commercial quotation.
- Quoted amounts are supplier proposals, not RNX revenue, verified payments, purchase orders, binding contracts or proof of fulfilment.
- No change is made to customer/supplier access controls, quote submission gates, quote status transitions or the existing notification centre.

## Database and configuration

- No new Supabase migration is required. The feature reads the existing `rnx_commercial_quotes` and `rnx_commercial_quote_events` tables created by migration 024.
- No new environment variables or external providers are required.
- The feature assumes migration 024 has been successfully applied in the existing RuffNeck Entertainment Supabase project.

## Verification boundary

- The v3.3.0 static regression script checks server-side authorisation, read-only data access, data minimisation, quote history, filtering/export UI and the absence of an unnecessary migration.
- Full TypeScript semantic typechecking, Next.js production build and live production data checks must still be confirmed in the deployment environment.
