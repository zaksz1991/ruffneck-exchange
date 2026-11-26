# RuffNeck Exchange v3.14.1 — Vercel root-module packaging repair

## Build failure addressed

The v3.14.0 Vercel deployment could not resolve these root-level modules:

- `lib/analytics-client.ts`
- `lib/admin-auth.ts`

The source modules are included at those exact paths in this release. The archive layout is deliberately flat: after extraction, `app/`, `components/`, `lib/`, `package.json` and the other project files are directly at the extracted root. There is no extra wrapper directory. This prevents the required modules from being inadvertently left outside the GitHub repository root.

A new regression test verifies that both files are present, non-empty, imported by their expected consumers, and covered by the existing `@/*` root alias.

## Deployment

- Replace the GitHub repository root with the contents of this archive's root. Do not create a nested `ruffneck exchange/` directory.
- Confirm GitHub shows `lib/analytics-client.ts` and `lib/admin-auth.ts` at the repository root before deploying.
- No Supabase migration is required. Keep migrations 001–032 unchanged.
- No Vercel environment variables or project settings need to change.

## Validation

- 35 existing regression scripts passed against the v3.14.0 baseline.
- A v3.14.1 root-module packaging regression test was added.
- Alias import audit found no missing `@/` targets in the complete source archive.
- Full Next.js production build was not run: dependency installation timed out in this environment. Vercel must confirm the deployment build.
