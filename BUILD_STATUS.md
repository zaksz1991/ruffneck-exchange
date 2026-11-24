# v3.6.0 build and validation status

- Source base: complete cumulative v3.5.0 project archive in the current workspace.
- Version: 3.6.0.
- Added private quote-specific customer/supplier message threads and generic in-app notification links.
- New Supabase migration: `026_rnx_commercial_quote_conversations.sql` (requires migrations 001–025).
- No new Vercel environment variables or third-party providers.

Validation completed in this workspace:
- 25 cumulative static regression scripts: passed.
- TypeScript/TSX syntax transpilation: 167 files checked; no syntax diagnostics.
- Complete source archive: 316 project files.
- ZIP archive integrity: verified after packaging.

Not verified in this workspace:
- Full TypeScript semantic typecheck; project dependencies are not installed here.
- Next.js production build.
- Live Supabase migration execution and two-party message flow.

Vercel must confirm full typechecking and the production build after deployment. Apply migration 026 before deploying the application. Test a genuine customer/supplier quotation after RNX contact release; verify unrelated accounts receive 404 and closed quotations are read-only.
