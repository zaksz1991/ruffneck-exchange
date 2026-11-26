# Build status — RuffNeck Exchange v3.15.0

- Baseline: complete cumulative v3.14.1 project archive.
- Upgrade: supplier catalogue CSV import for up to 25 listings per batch.
- New API route: `app/api/supplier/listings/import/route.ts`.
- Supplier dashboard: CSV template link, upload form, result feedback and moderation explanation.
- Template: `public/templates/rnx-catalogue-import-template.csv`.
- Safeguards: same-origin request check, authenticated supplier session, 250 KB request limit, CSV quote parsing, required headers, duplicate-header rejection, row-level schema/state validation, all-or-nothing file validation, active membership check and membership listing-limit check.
- Import behaviour: a single bulk insert after every row passes validation; new records are `pending` and use NGN, consistent with the current supplier listing form.
- New migration: none. Existing Supabase migrations 001–032 remain unchanged.
- Full TypeScript typecheck and Next.js production build: not verified in this environment because project dependencies are not installed. Vercel must confirm both after deployment.
