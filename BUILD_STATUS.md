# Build status — RuffNeck Exchange v3.13.0

- Source baseline: v3.12.0 complete cumulative project archive.
- Upgrade: customer resolution review and appeals for RNX trust cases.
- New Supabase migration: `031_rnx_trust_case_resolution_appeals.sql`.
- Appeal window: one appeal per resolved/closed case within 14 days of `resolution_published_at`; deadline enforced in a service-role-only database function.
- Accepted appeals reopen the case to `under_review`; not-upheld appeals retain the current case status. Each decision requires a customer-visible staff response.
- Regression checks: 33 scripts passed, 0 failed (all `scripts/test-*.mjs` executed individually).
- TypeScript/TSX syntax transpilation: 190 files passed, 0 syntax errors (TypeScript 5.8.3 `transpileModule`, excluding declaration-only files).
- Full TypeScript semantic typecheck: not verified; npm dependency installation timed out in the release workspace.
- Next.js production build: not verified; npm dependency installation timed out. Vercel must confirm after deployment.
- Live Supabase migration and end-to-end customer/staff appeal workflow: not executed in this workspace.

Static regression checks and syntax transpilation do not establish production build success or live Supabase behaviour.
