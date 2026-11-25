# RuffNeck Exchange v3.9.1 — Admin Quotation Event Rendering Fix

## Repair

- Fixed the production TypeScript error in `components/admin-commercial-quote-console.tsx`. The admin quotation history previously used an untrusted `unknown` JSON field as the result of a JSX `&&` expression. The revision-note condition now explicitly narrows the value to a non-empty string before rendering.
- The submitted-event display now uses a boolean condition rather than returning the `details` object as a possible JSX child.
- Changed the supplier gallery upload alignment value from `end` to `flex-end`, addressing the Autoprefixer warning shown in the v3.9.0 Vercel build log.

## Database and deployment

- No Supabase migration.
- No schema or customer-data changes.
- No new Vercel environment variables.
- Existing migration 028 and all previous migrations remain unchanged.

## Verification

- Includes a focused regression test for both JSX conditions and the CSS compatibility value.
- Full TypeScript typecheck and Next.js production build status are recorded in `BUILD_STATUS.md`; only report them as passed if executed successfully in the current environment.
