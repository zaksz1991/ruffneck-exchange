# RuffNeck Exchange v2.2.1 — production build type fix

## Fixed
- Fixed the Vercel TypeScript build failure in `app/api/supplier/listings/[id]/image/route.ts`.
- Supabase query builders expose a `PromiseLike` contract rather than a native `Promise`; the audit insert no longer chains an unsupported `.catch()` call after `.then()`.
- Audit insertion now uses `try`/`await`/`catch` and remains best-effort. A non-critical audit failure is logged without converting an already completed image upload into a failed response.
- No listing-image upload, validation, ownership, moderation, private-storage or signed-URL behaviour was intentionally changed.

## Database and environment
- No new Supabase migration is required. Keep previously applied migrations 001–015 as they are.
- No Vercel environment variable is added or changed.

## Validation boundary
- The targeted regression test verifies the PromiseLike-safe audit pattern and successful upload response path.
- The previous Vercel log confirms Next.js compilation passed and type checking stopped at the identified `.catch()` error. A new production build must confirm that the correction clears that error and reveal any subsequent type/build issues, if present.
