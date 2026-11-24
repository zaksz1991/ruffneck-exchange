# RuffNeck Exchange v2.2.2 — build and validation status

## Included functionality
- Retains the cumulative RNX application through v2.2.1, including marketplace discovery, enquiries, supplier listing editing, moderation and listing-image uploads.
- Retains v2.2.1's fix for Supabase PromiseLike audit handling in the supplier listing image upload route.
- Fixes the new Vercel TypeScript error reported at `app/api/supplier/listings/[id]/route.ts:84`. Both audit inserts in this route (listing edits and pause/resubmit actions) now use awaited Supabase inserts within local `try`/`catch` blocks.
- Supplier listing audit logging remains best-effort. An audit insert failure does not turn an already completed listing change into a failed API response.

## Validation
- The supplied Vercel log confirms Next.js compilation succeeded, then TypeScript checking stopped at the unsupported `.catch()` chained to a Supabase `PromiseLike<void>`. The same invalid pattern was present in the second audit insert in that route and has also been removed.
- Added `test-rnx-v222-supplier-listing-audit-fix.mjs` to assert both audit insert paths remain, are awaited and use safe error handling.
- The cumulative static regression suite is included in `npm run check`.
- Full TypeScript checking and a fresh Next.js production build have not been executed in this environment. The next Vercel build must verify the complete production build.

## Database and deployment
- No new Supabase migration. Existing migrations 001–015 remain unchanged.
- No new or modified Vercel environment variables.
- Deploy this complete source archive to the existing `main` branch and let the existing Vercel project build.
