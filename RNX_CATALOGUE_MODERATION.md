# RNX catalogue moderation — v0.3.0

## How submissions enter the catalogue

A business submits one application and may include its first product or service offer. The API stores the business application as `pending` and the optional offer as `pending`. Neither appears publicly until both approval checks are completed.

## Review steps in Supabase

1. Open the existing approved Supabase project and select Table Editor.
2. Review `rnx_supplier_applications`. Check business identity, authority to represent the business, contactability, website, product/service scope and evidence supplied outside the public form.
3. Approve only after the business checks are complete: change `status` from `pending` to `approved`. Reject or leave pending where evidence is insufficient.
4. Review `rnx_listings` separately. Check title, description, category, state, specifications, price basis, claims, legal/safety considerations and evidence of the supplier's authority to offer it.
5. Change a listing to `approved` only when the relevant details are substantiated. Use `rejected` or `paused` for content that should not appear.

## SQL examples

Use the actual UUID from the row. Do not copy these placeholders literally.

```sql
-- Approve a supplier only after verification
update public.rnx_supplier_applications
set status = 'approved'
where id = '<supplier-application-uuid>';

-- Approve a specific offer only after its independent review
update public.rnx_listings
set status = 'approved', updated_at = now()
where id = '<listing-uuid>';

-- Pause an offer immediately
update public.rnx_listings
set status = 'paused', updated_at = now()
where id = '<listing-uuid>';
```

## Privacy and marketplace controls

- Public supplier queries select only business name, business type, category, state, website, business description and public slug. They do not select contact person, private email or phone.
- Public listings are shown only when the listing is `approved` and its related supplier application is also `approved`.
- Do not publish private contact numbers, private email addresses, customer details, identity documents, unverified badges, unsubstantiated claims or private supplier pricing agreements.
- Approval of a business is not an endorsement of every claim, stock status, price or future transaction.
- Customer enquiries continue through the RNX request process. Contact details are not released to suppliers by catalogue browsing.

## Current limitations

This is a controlled first catalogue release. It does not include supplier login, self-service listing management, image upload, payments, subscription billing, automatic verification, admin moderation UI, inventory syncing, stock reservation or automated lead matching. The moderation steps above are manual and must be completed by an authorised operator.
