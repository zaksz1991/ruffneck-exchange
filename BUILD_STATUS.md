# Build status — RuffNeck Exchange v3.14.1

- Baseline: complete cumulative v3.14.0 source project.
- Repair: ensure `lib/analytics-client.ts` and `lib/admin-auth.ts` are included at exact root-relative paths expected by current imports.
- Archive layout: flat project root with no wrapper folder, to prevent nested extraction/upload errors.
- Added `scripts/test-rnx-v3141-required-root-modules.mjs` and `npm run test:rnx-v3141` to verify both files, their consumers and the `@/*` root alias.
- Alias import audit: 0 missing `@/` targets across the source archive.
- Existing static regression scripts: 35 passed.
- Database: no new migration. Existing migrations 001–032 remain unchanged.
- Full Next.js production build: not verified in this environment because npm dependency installation timed out. Vercel must confirm the build after the corrected repository contents are committed.
