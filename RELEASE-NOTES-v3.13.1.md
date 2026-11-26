# RuffNeck Exchange v3.13.1 — Trust-case tracking build repair

## Fixed

- Corrected the legacy-schema fallback in `app/api/track/[token]/route.ts`.
- The tracking API now keeps the primary trust-case query and legacy fallback query separate instead of assigning two differently shaped Supabase response types to one variable.
- When an older database lacks `resolution_published_at`, fallback rows are normalised with `resolution_published_at: null`, and the appeal feature is marked unavailable for that response.
- Existing customer-visible trust-case messages, evidence and appeal behaviour are otherwise unchanged.

## Database and deployment

- No new Supabase migration.
- No environment-variable changes.
- Keep migrations 001–031 as currently applied.
- Replace the repository with the complete contents of the `ruffneck exchange` folder and deploy from `main`.

## Verification boundary

- 34 cumulative regression scripts passed.
- TypeScript/TSX syntax transpilation passed for 190 files.
- The focused v3.13.1 regression test checks that the fallback query no longer reassigns a mismatched `PostgrestSingleResponse` type and that fallback rows include a null resolution timestamp.
- Full semantic TypeScript checking and a full Next.js production build remain unverified because dependency installation timed out in the release workspace. Vercel must confirm both. Do not treat static regression tests or syntax transpilation as a production build result.
