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

This release does not provide a document upload or evidence vault. Staff should follow internal data-minimisation procedures and use approved channels for any supporting records. Do not place bank credentials, payment-card details, passwords or full identity-document numbers in case notes.

Record what was reported, what was checked, who was assigned and what outcome was communicated. Distinguish a customer's allegation from evidence, supplier response and RNX's own findings. Do not label a supplier fraudulent or legally liable solely because a case was opened.

Case closure is an RNX operations status. It does not itself order a refund, reverse a bank transfer, determine legal liability or compel supplier performance. Any refund or credit still follows the existing independent payment verification and accounting controls.

## Database setup

Apply `010_rnx_trust_cases.sql` only after confirming migrations 001–009 have succeeded. The migration creates only RNX trust-case objects and grants table access to `service_role`; direct browser access remains revoked. No new environment variables are required. Optional notification delivery continues to use the existing Resend and notification-outbox setup.

## Known exclusions

- No file uploads or evidence vault.
- No automatic legal, fraud, licence or identity determination.
- No automated supplier suspension or public trust score.
- No refund, payment gateway or chargeback processing.
- No case submission without a valid private request tracking link.
- Supplier-specific complaints can only reference a completed, customer-approved introduction for that request.
