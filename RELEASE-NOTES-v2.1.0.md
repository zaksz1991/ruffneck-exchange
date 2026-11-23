# RuffNeck Exchange v2.1.0 — Supplier catalogue editing and re-review

## Supplier portal
- Edit existing pending, rejected and paused listings without creating duplicate catalogue entries.
- Correct a rejected offer and resubmit it for moderation.
- Pause an approved public listing before editing it; approved offers cannot be edited while live.
- Resubmit a paused listing unchanged when no edits are required.
- The edit form loads the current title, offer type, category, description, location, price and search keywords.

## Validation and moderation
- Every edit request requires a valid supplier session and same-origin request.
- The listing must belong to the authenticated supplier account.
- The server validates all editable fields and enforces the existing price rules.
- The server does not accept supplier ID, slug, currency, status or timestamps from the browser.
- Successful edits preserve the stable public slug and set the listing to `pending`.
- The update is status-guarded to reject stale edits and concurrent status changes. Supplier edits and listing status actions are written to the existing RNX audit log.
- The listing remains unavailable to public catalogue queries until RNX approves it again.

## Database and deployment
- No database migration is required; existing `rnx_listings` fields are reused.
- No new environment variable or external integration is required.
- Retains v2.0 listing-specific enquiries and earlier catalogue, supplier, trust, privacy and operations controls.
