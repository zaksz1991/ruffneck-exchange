# RuffNeck Exchange v1.0.0 — consent-first acquisition analytics

## Purpose
This release establishes a privacy-conscious conversion measurement baseline. It does not add general page-view tracking, advertising pixels, cross-site identifiers, fingerprinting or third-party analytics scripts.

## How it works
- The visitor is shown an optional analytics choice. No optional attribution is submitted until the visitor chooses **Allow optional analytics**.
- The choice is stored in browser storage for the user interface and in an HttpOnly, SameSite=Strict cookie for server-side enforcement. The cookie lasts 180 days.
- When analytics is accepted, the browser records a first-touch acquisition source, medium, optional UTM campaign, referring host only (not the full referrer URL), and landing path only (not query strings).
- Customer requests and supplier applications carry those optional values to the server. The server persists them only when the HttpOnly consent cookie says `granted`.
- Consent-gated conversion events are inserted into `rnx_events` without names, phone numbers, email addresses or request descriptions.
- The private `/admin/analytics` report returns aggregate totals, source/campaign/category/state summaries and daily trends. It does not return personal records.
- If the visitor declines or does not decide, attribution fields remain null and no conversion event is recorded. Operational request and supplier-application processing continues normally.

## Required migration
Apply `supabase/migrations/008_rnx_consent_first_attribution.sql` once after migrations 001–007. It alters only `rnx_leads`, `rnx_supplier_applications` and `rnx_events` and adds indexes. It does not grant browser access or modify any non-RNX table.

## UTM links
Use ordinary campaign query parameters in links you control, for example:

`https://ruffneck-exchange.vercel.app/request?utm_source=linkedin&utm_medium=organic&utm_campaign=industrial-sourcing-guide`

The report groups conversion submissions by source and campaign. Use consistent, lowercase naming across campaigns. Do not place customer names, phone numbers, email addresses or other personal information in UTM values.

## Dashboard
After the migration is applied, sign in to the RNX operations console and open **Acquisition analytics** or visit `/admin/analytics`.
- Reports cover 7, 30, 90 or 365 days.
- Operational totals include consented and non-consented submissions.
- Attribution breakdowns include only submissions for which optional analytics consent was granted.
- CSV export contains aggregate metrics only.
- A 5,000-row cap is applied per data series. The dashboard flags when a cap is reached.
- Verified lead-fee value includes only offer records with `payment_status='paid'` and `payment_verified_at` populated. It is not an audited accounting report.

## Data minimisation
- No IP address is collected or stored by this feature.
- No user-agent or device fingerprint is collected.
- No page-view stream or clickstream is collected.
- No full referrer URL or arbitrary query string is stored.
- UTM/referrer values are length-limited and reject common email/phone-like content.
- The server ignores client attribution unless the consent cookie is granted.

## Important operating note
A browser may clear local storage or cookies; then a visitor may need to choose again. If storage is unavailable, attribution is omitted. Review the privacy notice and retention period with a qualified privacy professional before commercial launch.
