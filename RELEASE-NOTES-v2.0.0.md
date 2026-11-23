# RuffNeck Exchange v2.0.0 — Listing-specific enquiries

## Buyer flow
- A customer can select **Enquire about this offer — free** from any approved public listing.
- The request form loads the listing from the approved catalogue and shows the offer title and supplier name as context.
- The category, supported state and request type are preselected where the listing provides valid values.
- A suggested requirement summary is editable; the customer remains responsible for confirming quantity, specifications, budget and timing.
- If the listing is no longer approved, the customer is informed and may still submit a general sourcing request.

## Server validation and data integrity
- The request endpoint accepts only a bounded listing slug, then resolves the listing and supplier itself.
- Both the listing and supplier must still be approved, and the supplier must have a public profile.
- Client-provided supplier names, listing titles and listing IDs are not accepted as authoritative values.
- `rnx_leads` stores a nullable foreign key to `rnx_listings` and snapshots the listing slug, title and supplier business name.
- Deleting a listing does not delete a customer lead; the foreign key becomes null while the snapshots preserve the enquiry context.
- No customer contact information is sent to the supplier. Existing supplier acceptance, verified payment and explicit customer permission gates remain unchanged.

## Operations and tracking
- The authorised operations lead queue displays the referenced offer and supplier snapshot.
- Supplier matching still requires staff qualification and a separate offer workflow; the original listing reference does not automatically choose a supplier.
- The customer's private tracking page displays the offer reference and the public listing link when available.
- Optional customer receipt and operations notification emails include the offer reference.

## Database / deployment
- Apply `supabase/migrations/014_rnx_listing_enquiry_context.sql` once, after migrations 001–013.
- No new environment variable, external provider, payment gateway or non-RNX database object is introduced.
- Retains v1.9 marketplace filtering, v1.8 operations error handling and earlier account, supplier, trust and privacy controls.
