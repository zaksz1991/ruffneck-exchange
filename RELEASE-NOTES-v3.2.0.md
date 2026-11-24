# RuffNeck Exchange v3.2.0 — Commercial Quotations for Authorised Introductions

## New functionality

- Suppliers can prepare structured commercial quotations for customer requests after the existing introduction has passed supplier acceptance, payment verification, customer approval and contact release.
- Each quotation records a reference, title, scope/specification, total amount, three-letter currency, delivery/payment terms, optional estimated fulfilment and a 1–60 day validity period.
- Customers see quotations in the relevant introduction card in their account dashboard and receive an in-app notification.
- Customers can mark one quotation across a sourcing request as their preferred proposal or decline a proposal. A new preferred proposal replaces the previous preferred selection in the dashboard history; submitted competing quotations are marked not selected.
- Suppliers can withdraw a quotation while it is awaiting a customer decision and can issue a revised proposal after decline, withdrawal or expiry.
- Expired quotations are automatically marked when customer or supplier dashboards load, and are also checked when a customer attempts to respond.
- A supplier email notification is queued when a customer marks its proposal as preferred, subject to existing Resend configuration.

## Commercial and trust boundaries

- The RNX lead/introduction fee remains separate from the supplier's commercial quotation.
- A customer preference selection is not payment, a binding contract, an order confirmation or proof of fulfilment.
- RNX does not collect the commercial payment, guarantee the supplier's amount, currency, tax, stock, specifications, delivery, warranty or performance, or determine the parties' contract terms.
- Supplier quotations cannot be submitted until payment verification, customer approval and contact release are recorded. The customer account must own the request.
- Supplier and customer actions are authenticated and checked by service-role-only database functions. Quote records and event history are private under RLS; public catalogue pages do not expose commercial quotes.
- One active submitted/selected quote is allowed per introduction, and only one quotation can be marked preferred per sourcing request at a time.

## Database

New migration: `supabase/migrations/024_rnx_commercial_quotes.sql`.

Apply only after migrations 001–023 have succeeded in the existing RuffNeck Entertainment Supabase project. No new Vercel environment variables or external providers are required. Existing Resend settings are reused for the supplier email notification.

## Verification boundary

The v3.2.0 static regression script verifies migration rules, API authentication, quote UI gates, notification wiring and commercial disclaimers. TypeScript/TSX syntax transpilation and the cumulative static regression scripts should be run after packaging. Full semantic typechecking, the Next.js production build and live Supabase RPC execution require the deployed dependencies and target project; static checks do not prove those live behaviours.
