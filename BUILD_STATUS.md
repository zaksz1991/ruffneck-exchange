# RuffNeck Exchange v2.2.1 — build and validation status

## Included functionality
- Retains the complete cumulative v2.2.0 application and supplier listing cover-image workflow.
- Fixes the Vercel TypeScript error in `app/api/supplier/listings/[id]/image/route.ts`: the Supabase insert builder is PromiseLike, so the unsupported `.catch()` chained after `.then()` has been removed.
- Audit insertion is awaited inside a local `try`/`catch`; audit failures are logged but do not turn a successful image upload into an HTTP 503 response.

## Validation
- The user's v2.2.0 Vercel log confirms Next.js compilation succeeded, then type checking failed at `PromiseLike<void>.catch()` on line 116 of the image upload route.
- The v2.2.1 targeted regression test checks that the audit insert is awaited, local best-effort error handling exists, and no unsupported PromiseLike `.catch()` chain remains.
- Cumulative static regression tests are included in `npm run check`.
- A fresh full TypeScript check and production build have not yet been run against this patch. The next Vercel build is required to confirm the complete production build.

## Database and deployment
- No new Supabase migration. Existing migrations 001–015 remain unchanged.
- No new or modified Vercel environment variables.
- Deploy the complete source archive to the existing `main` branch and allow the existing Vercel project to build.
