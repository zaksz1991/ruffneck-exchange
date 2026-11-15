# RuffNeck Exchange v1.8.0 — Marketplace Operations and Conversion

## Included changes

- Supplier approval failures now return actionable, classified responses instead of masking every Supabase database error as the same generic update failure.
- The email-confirmation trigger introduced in migration 013 is mapped to an explicit supplier email confirmation requirement. The application does not bypass that control.
- Schema, permission, duplicate-record and business-rule failures are distinguished. Database internals and personal data are not returned to the browser.
- Marketplace empty states now explain how customers can submit a free sourcing request and how suppliers can register. Existing query and category discovery are preserved; the selected category is retained when the visitor searches again.
- The How It Works page now describes the current operational model accurately, including manual payment verification and the distinction between RNX service fees and supplier purchases.

## Database and environment

- No Supabase migration.
- No environment variable changes.
- No payment gateway integration.
- No change to contact-release safeguards.
- No changes to shared non-RNX Supabase tables.

## Deployment build repair

The first v1.8.0 Vercel build compiled the Next.js bundle but failed TypeScript in `app/request/page.tsx` because `site.states.includes(requestedState)` passed an untrusted `string` to a literal-union array. The membership check now uses a `Set<string>` constructed from the existing configured state list. It does not expand the accepted states or trust arbitrary URL values.

## Validation boundary

The included focused static test checks the v1.8.0 source contracts. It is not a substitute for the complete repository test suite, TypeScript typecheck, Next.js production build, production Supabase checks or Vercel deployment validation.
