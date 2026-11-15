# RNX v1.9.0 — Marketplace Discovery

## Customer-facing changes
- Search results can now be narrowed by offer type and pricing model.
- Result ordering supports newest, oldest and alphabetical listing-title views.
- Active filters remain applied when customers move between a category and state view.
- Customers can clear filters without losing the ability to submit a free sourcing request.
- When no offer matches, the request route remains prominent; an empty catalogue result is not presented as proof that no supplier exists.

## Data and trust
- Only approved listings from approved suppliers remain eligible for public display.
- Filter options are allow-listed before they reach the catalogue query.
- Existing `rnx_listings` columns are reused; no migration is supplied or required.
- Price sorting is omitted because listing currencies are not guaranteed to be the same and nominal amounts must not be compared without currency conversion.

## Compatibility
- Retains the v1.8 supplier approval diagnostics and admin error classification.
- Retains the request-form category and state prefill behaviour.
- Retains the safe Set-based state allow-list that repairs the prior TypeScript build error.
