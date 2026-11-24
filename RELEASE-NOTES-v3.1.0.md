# RuffNeck Exchange v3.1.0 — Verified Transaction Outcomes and Supplier Reviews

## New functionality

- After a paid, customer-approved introduction has been contact-released, the customer and matched supplier can independently confirm whether the transaction was completed.
- A transaction is marked completed only when both sides confirm completion. Matching non-completion responses mark it cancelled. Conflicting responses are marked disputed and are not review-eligible.
- Customers with an RNX account-linked request can submit one 1–5 star review after both parties confirm completion.
- Reviews enter a private RNX moderation queue. Only reviews approved by authorised trust staff appear on public supplier profiles.
- Published reviews show the rating, title, written feedback and submission date.
- A supplier can publish one response to an approved review.

## Trust, access and privacy controls

- Outcome confirmation uses the existing authenticated customer and supplier sessions.
- The database function verifies that the actor is the customer attached to the lead or the supplier attached to the introduction.
- Transaction confirmation is blocked until payment is verified, the customer has approved the introduction and the contact-release record exists.
- Each party can record one immutable outcome. Different outcomes create a disputed record instead of a verified completion.
- A database trigger rejects review inserts unless the matching customer and supplier are recorded as having both confirmed completion.
- Guest-tracked requests that are not linked to a customer account are not eligible for verified reviews in this release.
- Customer contact details are not exposed on public review pages. Supplier identity is returned to the customer dashboard only after the existing contact-release gates have succeeded.
- Review publication requires RNX moderation; suppliers cannot publish or edit customer reviews.

## Database

New migration: `supabase/migrations/023_rnx_verified_transaction_reviews.sql`.

Apply only after migrations 001–022 have succeeded. It creates two RNX-prefixed tables and a service-role-only outcome-confirmation function. It does not alter non-RNX tables or delete existing data.

## Configuration

No new Vercel environment variables or external providers are required.
