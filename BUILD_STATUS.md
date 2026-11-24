# v3.4.0 build and validation status

- Source base: complete cumulative RuffNeck Exchange v3.3.0 project archive uploaded in this conversation.
- Version: 3.4.0.
- New Supabase migration: `025_rnx_supplier_quote_notifications.sql`; requires migrations 001–024.
- Added private supplier notification centre for quote statuses `selected`, `not_selected`, `declined` and `expired`.
- Added authenticated supplier read-state API at `/api/supplier/notifications`; updates are same-origin and supplier-scoped.
- Extended supplier dashboard API with the latest 40 notifications and unread count. Missing migration 025 is handled as a temporary unavailable feature so the existing dashboard remains usable before the migration is applied.
- No new environment variables or external providers.

Validation performed in this environment:
- All 23 cumulative static regression scripts: passed.
- TypeScript/TSX syntax transpilation: 162 of 162 files passed.
- ZIP integrity: checked after packaging.
- Full TypeScript semantic typecheck: not verified; project dependencies and framework type declarations are not installed in this workspace. A global `tsc` attempt reported missing dependencies/types, so it cannot establish project-level type correctness.
- Next.js production build: not run; dependencies are not installed in this workspace.
- Live Supabase trigger and supplier portal test: not run in this environment. Migration 025 must be applied before testing.

Vercel must confirm the full TypeScript check and production build after deployment. The migration and supplier portal workflow must be tested in the existing RuffNeck Entertainment project.
