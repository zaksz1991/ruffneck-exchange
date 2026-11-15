# RuffNeck Exchange v1.8.0 — build repair status

## Included
- Supplier approval diagnostics for the supplier email-confirmation restriction; verification is not bypassed.
- More useful database error classification without exposing raw Supabase internals to the client.
- Marketplace empty-state guidance for customers and suppliers.
- Safe prefill of category and state context in the sourcing request form.
- Updated How It Works and README operating descriptions.
- TypeScript fix for URL-prefilled state validation in `app/request/page.tsx`.

## Exact Vercel failure addressed
Vercel previously stopped at `app/request/page.tsx:18` because a URL query parameter is a plain `string`, while `site.states.includes()` expected one member of a literal union. The replacement uses `new Set<string>(site.states).has(requestedState)`. This preserves the configured state allow-list and rejects unsupported query values.

## Validation actually completed in this package workspace
- Focused v1.8.0 test: 20 assertions passed.
- ZIP integrity: passed.
- Static check confirms the Set-based allow-list and absence of the failing `site.states.includes(requestedState)` call.

## Not verified
- Full repository TypeScript project check.
- Full Next.js production build.
- Vercel deployment.
- Production Supabase operations or email delivery.

The complete repository and installed project dependencies were not present in this package workspace. Do not treat the focused test as proof of a complete production build.

## Database and environment
No SQL migration, new environment variable, payment gateway or change to non-RNX database objects is included.
