# RuffNeck Exchange v3.6.0 — Private Commercial Quotation Conversations

## New functionality

- Customers and introduced suppliers can exchange quotation-specific messages from their respective signed-in dashboards.
- Each conversation is attached to one commercial quotation and scoped to the customer and supplier recorded on that quote.
- Messages support plain text from 2 to 2,000 characters. The dashboard loads the latest 150 messages per quote.
- New messages generate generic in-app notifications for the other participant. The message body is not copied into notifications.
- Notification links open the associated quotation conversation in the relevant dashboard.
- Historical messages remain viewable after a quotation closes; new messages are blocked once it is no longer submitted/selected, expires, or the transaction outcome is completed, cancelled or disputed.

## Security and privacy

- Customer routes require the signed customer session and an active customer record. Supplier routes require the authenticated approved supplier portal session.
- Every message read is scoped to the authenticated participant's `customer_id` or `supplier_application_id`.
- Sending is validated again inside a database function, including quote ownership, active account, authorised contact release, verified introduction payment and transaction outcome.
- Message storage has RLS enabled and browser-role access revoked; the server uses the existing Supabase service-role client only after session checks.
- Messages render as escaped plain text. They are not interpreted as HTML.

## Database and configuration

- New migration: `supabase/migrations/026_rnx_commercial_quote_conversations.sql`.
- Apply after migrations 001–025 in the existing RuffNeck Entertainment Supabase project.
- No new environment variables, providers or payment integrations. Existing session secrets and Supabase credentials are reused.

## Verification boundary

- Static regression checks cover migration objects, participant ownership, contact-release gating, closed transaction checks, API authentication, dashboard integration and message length constraints.
- Full TypeScript semantic typechecking and the Next.js production build must be confirmed by Vercel after deployment.
- Live testing should use a real customer/supplier pair with an authorised, contact-released quotation. Verify both parties can read/send, unrelated accounts receive 404, closed quotes are read-only and generic notifications link to the right quote.
