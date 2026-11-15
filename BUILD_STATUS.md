# Build status — RuffNeck Exchange v1.8.0 build repair

## Release scope
Marketplace operations clarity, supplier approval diagnostics and sourcing-request conversion.

## Implemented in this source update
- Admin status update route maps the migration 013 supplier email-confirmation trigger to a clear HTTP 409 response. It does not bypass verification.
- Database rule, duplicate, schema and server-permission errors are classified without exposing raw Supabase internals to the client.
- Marketplace empty state offers clear customer and supplier next steps.
- Filtered category/state context can be carried into the request form and prefilled safely.
- How It Works and README now reflect manual RNX fee verification and current supplier-introduction safeguards.

## Database and environment
- No SQL migration.
- No new environment variable.
- No payment gateway changes.
- No changes to shared non-RNX tables.

## Build repair from deployment log
- Vercel compiled the Next.js application successfully, then TypeScript failed at `app/request/page.tsx:18` because `site.states.includes()` expects a literal-union value while URL query parameters are plain strings.
- The state allow-list check now uses `new Set<string>(site.states).has(requestedState)`. This preserves the configured state allow-list, rejects arbitrary query values and resolves the specific argument-type mismatch without casting untrusted input.

## Validation scope
- Focused v1.8.0 static contract test now includes the state-query type-safety contract.
- The complete project typecheck and Vercel production build must be rerun against the connected repository; they have not been executed in this repair workspace because the full repository and installed dependencies are not present here.
- Production database behaviour, email verification delivery, GitHub commit and Vercel deployment have not been performed here.
