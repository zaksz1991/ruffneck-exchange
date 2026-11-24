# RuffNeck Exchange v3.0.0 — Supplier Listing Performance Insights

## New functionality

The supplier portal now provides a per-listing performance report for published marketplace offers:

- Consent-based detail-view counts for the last 7 and 30 days.
- Aggregate customer saves across the listing's lifetime.
- Aggregate sourcing enquiries linked to the exact listing.
- A direct link from each report row to its public listing page.

## Privacy and measurement limits

A detail-view event is recorded only when the visitor has accepted optional analytics. The browser records at most one event for a given listing per tab session. The event table stores only the listing reference, supplier reference and server timestamp; it does not store customer account or contact fields, IP address or device identifier. Supplier reports show aggregate counts, not customer records.

View counts are not unique-person counts. Visitors who decline optional analytics are excluded, and the counts begin only after migration 022 and the v3.0.0 deployment are active. Saves and enquiries are aggregate totals, not evidence of a completed purchase or sale.

## Database

New migration: `supabase/migrations/022_rnx_supplier_listing_analytics.sql`.

It creates an RNX-private view-event table, a publication-integrity trigger and a service-role-only aggregate metrics function. It does not modify non-RNX tables and does not reference `rnx_listings.availability_status`.

## Configuration

No new environment variables or external services are required. The existing Supabase server credentials and current consent cookie are reused.
