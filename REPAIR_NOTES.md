# RuffNeck Exchange v0.1.2 repair patch

This is a targeted patch for the existing `zaksz1991/ruffneck-exchange` repository. It is not a replacement project. Preserve all files not included in this patch.

## Files replaced

- `package.json` — updates the patch version to 0.1.2. The existing Next.js 15 lint command is retained: its deprecation warning is not the cause of the Vercel deployment integration error, and adding an unverified lint toolchain could introduce a new build failure.
- `lib/site.ts` — removes the `example.com` production URL fallback; prefers an explicit `NEXT_PUBLIC_SITE_URL`, then Vercel's production/deployment domain variables, then the RNX Vercel fallback. Adds category search keywords.
- `app/marketplace/page.tsx` — makes the existing search form process query, category and state parameters. Search is category-taxonomy matching only; it does not pretend live supplier inventory exists.
- `app/marketplace/[state]/page.tsx` — keeps location pages available to users but marks them noindex until unique local content and real supplier coverage exist.
- `app/sitemap.ts` — removes the thin state-template pages from the sitemap until they are ready to be indexed.
- `app/api/leads/route.ts` and `app/api/supplier-applications/route.ts` — separate invalid form submissions from server/database failures, avoid returning raw database errors to visitors, and keep customer contact release locked.
- `app/request/page.tsx` and `app/business/register/page.tsx` — handle network errors and failed responses clearly, and reset forms after successful submission.

## Important limits

- This patch does not solve or modify Vercel's GitHub repository-ID integration error. That error occurs before application compilation.
- This patch does not create live marketplace listings, supplier inventory, authentication, payments, admin tools or automated lead matching.
- No Supabase migration is included. Do not run or modify any database migration as part of this patch.
- The patch has been checked for JSON syntax and ZIP integrity. A full dependency installation, ESLint run and `next build` have not been executed in this environment. Do not treat the patch as a verified successful deployment until Vercel completes a build.
