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


## v3.6.0 — private quotation conversations

After an RNX introduction has passed supplier acceptance, payment verification, customer approval and contact release, the customer and introduced supplier can exchange quotation-specific messages from their dashboards. Messages are attached to one quotation, restricted to its two recorded participants and stored as plain text. Each new message creates a generic in-app notification for the other party; the content itself is not copied into the notification. Conversation history remains readable after closure, but sending is blocked for expired, withdrawn, declined, not-selected or otherwise closed quotes, and after a transaction outcome is completed, cancelled or disputed.

Apply `supabase/migrations/026_rnx_commercial_quote_conversations.sql` after migration 025. Messages are not a contract, RNX does not process the commercial payment, and parties must independently verify final terms and payment details.


## v3.7.0 — private quotation conversation attachments

After the same RNX contact-release gate used for quotation conversations, either participant may share one PDF, JPEG, PNG or WebP file with an optional short note. Files are limited to 4 MB each, up to 20 attachments per quotation, and are validated from their file signatures. The object bucket is private; message-list JSON exposes only file metadata and does not include raw storage paths. A participant must sign in to the corresponding customer or supplier account to request a 5-minute signed download link. The database attachment RPC calls the existing message RPC, so the same quote ownership, account, contact-release, quote validity and transaction-outcome checks apply. Attachments are read-only conversation records; the application does not scan files for malware and users must share only material relevant to that quotation.

Apply `supabase/migrations/027_rnx_commercial_quote_attachments.sql` after migration 026. The private Storage bucket is created/configured automatically on the first valid upload. No new environment variable or third-party provider is introduced.
