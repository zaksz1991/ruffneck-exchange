# RuffNeck Exchange v2.2.2 — supplier listing audit PromiseLike fix

## Fixed
- Fixed the Vercel TypeScript build error in `app/api/supplier/listings/[id]/route.ts`.
- Replaced both supplier listing audit chains that called `.catch()` on Supabase query-builder thenables.
- Both audit inserts now use `try`/`await`/`catch`, matching the PromiseLike-safe pattern already applied to listing-image audit logging in v2.2.1.
- Audit logging remains best-effort. Listing edits, pauses and resubmissions are not reported as failed solely because a non-critical audit insert fails.
- No supplier listing status rules, ownership checks, validation, moderation visibility or database schema were changed.

## Database and environment
- No new Supabase migration is required. Keep migrations 001–015 as currently applied.
- No Vercel environment variable is added or changed.

## Validation boundary
- Added a regression test covering both audit insert paths and forbidding native `.catch()` chaining on Supabase query-builder thenables.
- Full TypeScript checking and the Next.js production build must still be confirmed by Vercel.
