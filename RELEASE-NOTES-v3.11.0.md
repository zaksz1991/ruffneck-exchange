# RuffNeck Exchange v3.11.0 — Supplier Trust-Case Response Centre

## New functionality

- RNX Operations can explicitly request a response from the supplier attached to a customer complaint or dispute by moving the case to `awaiting_supplier`.
- The supplier receives a private dashboard notification linked to the case.
- The supplier portal now includes a case response centre showing assigned case summaries, the customer report and customer-visible case conversation. Supplier notifications link directly to the assigned case.
- Suppliers can submit a factual response only while the case is in `awaiting_supplier`. A successful response is attributed to the supplier account, displayed in the customer tracking thread and admin case workspace, recorded in the event history, and moves the case to `under_review`. Customer and optional RNX Operations email notices are queued through the existing notification worker without including the private tracking URL.
- RNX can request another supplier response later by moving the case back to `awaiting_supplier`.

## Privacy and controls

- The supplier API returns only cases explicitly assigned to that supplier and for which RNX has requested a response.
- Supplier responses require the active authenticated supplier session, exact case ownership, an active approved portal account, and the associated introduction's supplier acceptance, RNX-verified payment, customer approval and contact release.
- Suppliers cannot read staff-only internal notes, customer contact fields or unrelated request records through the case response API.
- Supplier responses are customer-visible. They are an attributed account statement, not proof that the account's claims are correct or a finding of liability.
- A response moves the case to `under_review`; only RNX Operations controls case severity, assignment, resolution and closure.
- Existing customer and staff messages remain intact. No document upload or payment handling is introduced.

## Database and deployment

- New migration: `supabase/migrations/029_rnx_supplier_trust_case_responses.sql`.
- Apply after migrations 001–028 in the existing RuffNeck Entertainment Supabase project.
- No new Vercel environment variables, storage buckets or third-party services. Supplier responses use the existing email notification worker for customer and optional RNX Operations notices.
- The migration adds supplier authorship attribution to trust-case messages/events, a response-request timestamp, the notification link and a service-role-only response function.

## Verification boundary

- Adds a v3.11.0 regression script covering migration constraints, ownership checks, response-request notification, customer visibility, internal-note exclusion and status transitions.
- Static regression scripts and TypeScript/TSX syntax transpilation are checked in the release workspace.
- Full TypeScript semantic typechecking, Next.js production build and live two-account case workflow must be confirmed in Vercel and the deployed application.
