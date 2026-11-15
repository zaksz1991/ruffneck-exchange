# RNX supplier introduction workflow — v0.6.0

## Required order

1. A customer submits a free sourcing request.
2. Operations staff qualify the request and set it to `qualified` or `matched`.
3. Staff select an approved supplier and create an offer. The offer brief must not identify the customer.
4. Assign the anonymised opportunity and proposed fee to that supplier. The supplier sees it in the private portal. Staff must send any notification manually because no email, SMS or WhatsApp provider is connected.
5. The supplier explicitly accepts or declines in the portal. A declined offer cannot proceed to payment or customer approval. Staff must not record acceptance on the supplier's behalf without the supplier's explicit agreement.
6. After acceptance, operations checks the actual bank or payment-provider transaction record. Enter the independently confirmed received amount, currency and reference. The amount must equal the quoted fee; a screenshot or unverified supplier-submitted reference is not proof of receipt.
7. Only after supplier acceptance and verified payment, staff send the private customer approval URL to the customer's preferred channel.
8. Customer reviews the named supplier and anonymised requirement, then approves or declines. The consent page never returns their name, phone or email.
9. Contact information may be shared only after both verified payment and customer approval. Staff share manually through an approved channel, then record **Contact shared**.

## Security properties

- Customer approval tokens are generated from 256 random bits. Only the SHA-256 hash is stored in Supabase.
- Approval links expire after seven days. Staff can regenerate a link while the customer has not made a decision.
- Customer decision is stored against a specific lead offer and cannot be inferred from a generic checkbox on the original request form.
- Public approval API returns supplier identity, the anonymised brief, category and location only. It never returns customer contact data.
- Supabase tables have RLS enabled and browser roles have no table privileges. Server routes use the server-only Supabase secret key.
- The database refuses payment verification without supplier acceptance and refuses contact release without both verified payment and customer approval.
- The lead contact-release field is changed only by the database contact-release function.
- Supplier portal requests are scoped to the signed-in supplier record. Customer identity and details remain redacted until the authorised contact-release workflow has completed.

## Operator rules

- Never include customer identifying information in the anonymised offer summary.
- Do not treat a screenshot as proof of payment. Confirm the transaction in the bank or payment-provider ledger.
- Verify the amount equals the agreed fee and record the actual confirmed transaction reference. Resolve mismatches before recording payment.
- Do not send customer contact details to suppliers before both checks have passed.
- Record contact release only after the details have actually been shared. The database record is an audit event, not an automatic message.
- A customer may decline without charge. Do not pressure customers to approve.
- If a paid offer is declined, use the documented refund or credit process before any contact release.

## Limitations

There is no payment gateway integration, automatic email/SMS/WhatsApp delivery, automatic supplier identity verification or multi-user role system. Supplier offer notifications, payment reconciliation and contact handoff remain manual operator tasks; supplier offer acceptance itself is recorded by the supplier in the portal.
