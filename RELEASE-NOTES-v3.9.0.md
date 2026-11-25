# RuffNeck Exchange v3.9.0 — Customer-Requested Commercial Quotation Revisions

## New functionality

- Customers can request changes to a submitted supplier quotation without having to decline it first. The customer supplies a 10–800 character explanation.
- The original quote is retained with status `revision_requested`; the customer note and event are stored for the relevant customer, supplier and RNX Operations.
- Suppliers receive a private in-app notification and can respond with a new quotation record linked to the original quote. The original quote is not overwritten.
- Revisions are version-linked through `revision_of_quote_id`. Each revision request can produce at most one new quote; a new request on the next quote can continue the chain.
- The supplier's revised submission is checked through the existing supplier approval, introduction acceptance, RNX-verified payment, customer approval, contact-release and transaction-outcome gates.
- If another proposal is selected for the sourcing request while a revision request remains open, the outstanding revision request is closed as `not_selected`.
- RNX Operations can filter revision-requested quotations and review revision events and notes.

## Trust and commercial boundaries

- The original submitted amount and scope remain unchanged; a revised quotation is a separate immutable record.
- A revision request is not acceptance, payment, an order, a purchase order, a binding contract or evidence of fulfilment.
- RNX does not process supplier-customer commercial payments. The RNX introduction fee remains separate.
- Existing customer and supplier session checks and service-role-only database execution remain in place.

## Database and deployment

- New migration: `supabase/migrations/028_rnx_commercial_quote_revision_requests.sql`.
- Apply after migrations 001–027 have succeeded in the existing RuffNeck Entertainment Supabase project.
- No new Vercel environment variables, storage buckets, payment providers or third-party services.

## Verification boundary

- Adds a v3.9.0 static regression test for the migration, database authorization, participant checks, customer and supplier workflows, notification delivery wiring and Operations visibility.
- Existing cumulative static regression scripts and TypeScript/TSX syntax transpilation are included in the release validation.
- Full TypeScript semantic typechecking, Next.js production build and live customer/supplier/RPC execution must be confirmed in the deployment environment.
