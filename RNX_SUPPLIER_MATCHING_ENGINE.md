# RNX v0.8.0 — Supplier Matching Recommendations

## What changed
- Adds a private administrator endpoint at `POST /api/admin/matches`.
- Adds an explainable recommendation panel to the supplier-offer workflow in `/admin/login`.
- Ranks only approved suppliers and their approved catalogue listings.
- Uses request category, supplier category/business type, approved listing category/keywords, listing type and state/city alignment.
- Excludes suppliers already offered the same request.
- Shows the reasons behind each recommendation and up to three relevant approved catalogue items.
- Keeps manual supplier selection available. An operator must select a candidate and create the opportunity offer through the existing workflow.

## Score model
The score is a deterministic internal sorting aid. It awards points for supplier category alignment, exact or related approved listing category, matching catalogue keywords, registered/listing state, city and request/listing-type compatibility. It is capped at 100 and is not calibrated against historical conversion data.

It is not an AI model, supplier quality rating, success probability, certification, due-diligence result, stock check, service capacity check, price quote or availability confirmation. Do not describe it as any of those.

## Privacy and workflow
- Endpoint requires the existing administrator session and same-origin request checks.
- It accepts a lead ID and returns only approved supplier identity/category/location and approved catalogue details.
- It does not return customer name, telephone number, email, original requirement details or tracking token.
- It does not send supplier notifications or create offers.
- The existing offer workflow still validates the anonymous brief, supplier approval and lead qualification. Supplier acceptance, payment verification and customer permission remain separate required steps before contact release.

## Database
No new migration is required. This release reads tables and fields created by migrations 001–006. Apply no additional SQL for v0.8.0.

## Operational limits
- Candidate retrieval is capped at 500 approved suppliers and 1,500 approved listings per request. Expand only after measuring real catalogue size and database query limits.
- A supplier may still be operationally unsuitable even when its category/location score is high. Operations must verify current capacity, stock, service coverage, prices, licences/registrations where relevant, delivery terms and willingness to accept the opportunity.
- The matching rules should be reviewed against real outcomes before using conversion or performance claims.
