# RNX Commercial Quotations

## Purpose

The commercial quotation workspace gives an approved supplier and a customer an auditable way to exchange a priced proposal after RNX has completed its restricted introduction process. It is distinct from the fee RNX may charge for qualifying and releasing the supplier introduction.

## Eligibility

A supplier may submit a commercial quote only when:

- the supplier owns the opportunity and is currently approved;
- the related lead is linked to a customer account;
- the supplier has accepted the opportunity;
- the RNX introduction fee is paid and verified;
- the customer approved that specific supplier introduction; and
- RNX recorded contact release.

Quotes cannot be submitted after the transaction outcome has been finalised as completed, cancelled or disputed.

## Quote fields

Each proposal contains a supplier-entered title, scope/specification, total amount, ISO-style three-letter currency code, delivery/payment/other terms, optional fulfilment estimate and validity (1–60 days). The quote is an immutable submitted record. If a quote is declined, withdrawn or expired, the supplier can submit a new proposal. A pending quote can be withdrawn by its supplier.

## Customer decisions

Customers with an RNX account can view the proposals connected to their own authorised introduction. They may:

- mark one submitted proposal as preferred; or
- decline a submitted proposal.

Only one proposal for a sourcing request can be preferred at a time. A later selection changes the earlier preferred proposal to `not_selected`; the event history is retained. Submitted alternatives are also marked `not_selected` when the customer makes a selection.

A preference selection is not an order, payment, binding agreement, proof of fulfilment or guarantee of availability. Parties must independently confirm specifications, quantities, currency, taxes, delivery, payment destination, warranties, returns, timelines and any contract terms before committing funds.

## Quote statuses

- `submitted`: waiting for customer decision and still within validity.
- `selected`: customer marked it as preferred.
- `not_selected`: customer selected a different proposal for the sourcing request.
- `declined`: customer declined this proposal.
- `withdrawn`: supplier withdrew the proposal before customer selection.
- `expired`: validity elapsed without a customer decision.

## Security and privacy

- All quote tables have RLS enabled and no direct anon/authenticated privileges; server routes use the existing Supabase service-role client after checking the signed customer or supplier session.
- Database functions re-check supplier ownership, customer ownership, the introduction payment/approval/release gates, quote state and expiry.
- Quote records are loaded only in the authenticated customer or owning supplier dashboard.
- The customer receives an in-app notification when a quote is submitted. A supplier email notification is queued when the customer marks the quote as preferred, using the existing notification worker and Resend configuration.
- Public supplier profiles, marketplace pages and search APIs do not display private commercial quotations.

## Deployment

Apply `supabase/migrations/024_rnx_commercial_quotes.sql` after migrations 001–023. No additional environment variables are introduced.
