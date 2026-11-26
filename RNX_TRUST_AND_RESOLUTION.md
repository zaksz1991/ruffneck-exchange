# RNX Trust, Complaints and Resolution — v1.2.0

## Customer intake

Customers submit a case from the private tracking page attached to an existing sourcing request. The tracking token is a high-entropy secret; anyone possessing it can access that request, so customers must keep it private. Case intake is not a public anonymous tip line and is not available without the corresponding tracking link.

Each case captures an issue type, short summary, description and optional requested outcome. If the customer selects a supplier, the API accepts only an existing offer for the same request for which payment was verified, customer approval was recorded and contact release was recorded. This prevents a customer from attaching a case to a supplier they were not introduced to through the controlled RNX workflow. Do not ask customers to submit passwords, card data, bank PINs, identity document numbers or other unnecessary secrets. Do not upload identity documents into the case narrative.

## Case types

- General complaint
- Delivery issue
- Product quality
- Service quality
- Payment dispute
- Supplier conduct
- Suspected fraud or misleading activity
- Other

A customer-selected case type records the nature of the report; it does not prove that the reported event occurred.

## Status lifecycle

- `new`: received and not yet triaged.
- `triaged`: reviewed and awaiting handling.
- `awaiting_customer`: RNX requested more information from the customer.
- `awaiting_supplier`: RNX is seeking a response from the supplier.
- `under_review`: RNX is assessing the available information.
- `resolved`: RNX has recorded a customer-visible outcome summary.
- `closed`: operational handling is closed.

Permitted transitions are constrained by the API. A case can be reopened to `under_review` from `resolved` or `closed`. A case cannot be marked resolved without a customer-visible resolution summary.

## Staff handling

Owner, operations administrator and customer support roles can read and write trust cases. Finance and analyst roles are excluded from case-level customer details. A case can be assigned to an active staff member. Severity is an internal prioritisation field (`low`, `normal`, `high`, `critical`); it is not a conclusion about liability or wrongdoing.

Staff messages have two visibility levels:
- `customer`: included in the customer's private case thread.
- `internal`: visible only to authorised staff.

The tracking API filters messages to `visibility=customer`. Do not include internal investigative details, personal data about other people or unverified allegations in a public reply.

## Evidence and fair handling

The v3.12.0 evidence vault supports case-related PDF, JPEG, PNG and WebP files, with a 4 MB per-file limit and 20 files per case. Customer, assigned supplier and authorised staff uploads are attributed and recorded in the event history. Staff may mark an upload as internal-only or customer-visible. Files are stored in a private Supabase Storage bucket and are available through five-minute signed links after case-specific access checks. The vault validates file signatures but does not scan for malware. Do not place bank credentials, payment-card details, passwords or unnecessary full identity-document numbers in case files or notes.

Record what was reported, what was checked, who was assigned and what outcome was communicated. Distinguish a customer's allegation from evidence, supplier response and RNX's own findings. Do not label a supplier fraudulent or legally liable solely because a case was opened.

Case closure is an RNX operations status. It does not itself order a refund, reverse a bank transfer, determine legal liability or compel supplier performance. Any refund or credit still follows the existing independent payment verification and accounting controls.

## Database setup

Apply `010_rnx_trust_cases.sql` only after confirming migrations 001–009 have succeeded. The migration creates only RNX trust-case objects and grants table access to `service_role`; direct browser access remains revoked. No new environment variables are required. Optional notification delivery continues to use the existing Resend and notification-outbox setup.

## Known exclusions

- No automated malware scanning or independent authenticity verification for uploaded evidence.
- No automatic legal, fraud, licence or identity determination.
- No automated supplier suspension or public trust score.
- No refund, payment gateway or chargeback processing.
- No case submission without a valid private request tracking link.
- Supplier-specific complaints can only reference a completed, customer-approved introduction for that request.


## Supplier response centre — v3.11.0

RNX Operations may request a response from the supplier attached to an authorised, contact-released introduction by moving a case to `awaiting_supplier`. The supplier receives a dashboard notification and can submit a 10–3,000 character factual response from the private supplier portal. The response is attributed to the supplier account, visible to the customer and authorised staff, and recorded in the event history. Successful submission moves the case to `under_review`. RNX can request a further response by transitioning the case to `awaiting_supplier` again.

The supplier response API returns only cases explicitly assigned to that supplier after RNX has requested a response. It excludes internal staff notes and customer contact fields. Supplier responses require the active supplier session and re-check the matching introduction's supplier acceptance, RNX-verified payment, customer approval and contact release. Supplier responses are account statements, not verified findings. RNX Operations retains authority over severity, assignment, resolution and closure. Apply migration `029_rnx_supplier_trust_case_responses.sql` after migrations 001–028.


## Private evidence vault — v3.12.0

Customers may add supporting records from the private tracking link while a case is open. An assigned supplier may attach a factual supporting record only after RNX has explicitly requested a response and the case is in `awaiting_supplier`. Staff with `trust:write` can add files with `customer` or `internal` visibility. Internal files are excluded from customer and supplier APIs.

The `rnx-trust-case-evidence` bucket is private. The server creates/configures it automatically on the first upload. Metadata and `evidence_uploaded` events are written through the service-role-only RPC in migration `030_rnx_trust_case_evidence_vault.sql`. Migration 030 must be applied after migrations 001–029.


## Customer resolution review and appeals — v3.13.0

When RNX publishes a customer-visible resolution and moves a trust case to `resolved` or `closed`, the customer can request one review within 14 days using the same private request tracking link. The customer must provide a 20–2,000 character explanation. The database checks the deadline against `resolution_published_at`; the browser display is informational only. The case must belong to the lead resolved from the high-entropy tracking token.

Appeal records are stored in `rnx_trust_case_appeals`, a service-role-only table with RLS enabled and browser roles revoked. The RPC `rnx_submit_trust_case_appeal` locks the case, checks the terminal status and 14-day window, enforces one appeal per case, creates the appeal and records the event transactionally. Migration 031 backfills resolution timestamps for older terminal cases and adds a trigger for later status transitions.

RNX staff with `trust:write` can accept an appeal or not uphold it. An accepted appeal reopens the case at `under_review` and clears the active resolution timestamp so a later resolution starts a new review window; the appeal record retains the original status and resolution timestamp. A not-upheld decision leaves the current case status unchanged. Both decisions require a 10–1,800 character customer-visible response and are recorded with the reviewer and event history.

An appeal decision is an RNX operational review. It is not a legal determination, refund instruction, payment reversal or proof of wrongdoing. One appeal is allowed per case, including after an accepted appeal has led to further investigation. Apply `031_rnx_trust_case_resolution_appeals.sql` after migrations 001–030.


## v3.13.1 tracking compatibility repair

The public tracking API supports older trust-case schemas that do not yet expose `resolution_published_at`. Its fallback query omits that column and normalises the returned records to `resolution_published_at: null`; the resolution appeal feature is reported unavailable for that tracking response. The fallback does not modify the database. No migration is associated with v3.13.1.
