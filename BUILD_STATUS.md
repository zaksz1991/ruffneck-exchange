# Build status — RuffNeck Exchange v1.1.0

## New capability

This release adds multi-user staff accounts, owner-managed invitations, five operational roles, API/page permission checks, session revocation on suspension, an owner-only staff management screen and a staff activity stream.

## Changes

- Replaced the old administrator session payload with a versioned HMAC-signed staff session. Staff sessions resolve the current active database role for every protected request.
- Retained `RNX_ADMIN_PASSWORD` as an owner-only recovery login. It is not removed by this release.
- Added scrypt password hashing for invited staff credentials.
- Added single-use invitation tokens; only SHA-256 hashes are persisted. Invitations expire after 48 hours.
- Added an atomic PostgreSQL invitation-acceptance function and a trigger that prevents demotion/suspension of the last active staff owner.
- Enforced permissions on administrator pages and operations, analytics, membership, communication, matching, offers, notification-processing and supplier-portal APIs.
- Added owner-only `/admin/staff` interface with account state, invitation history and recent activity views.
- Added `/admin/finance` lead-fee reconciliation view. Its API response deliberately excludes customer name, phone and email fields.
- Added migration 009 and `RNX_STAFF_ACCESS_CONTROL.md`.

## Database impact

Migration `009_rnx_staff_access_control.sql` creates only RNX staff tables/functions/trigger. It does not edit non-RNX tables. Apply it only after verifying migrations 001–008 are present. No new environment variable is required; `RNX_ADMIN_EMAIL` is optional.

## Validation performed

- TypeScript/TSX syntax transpilation: 109 files, zero syntax errors.
- Static TypeScript check with temporary declarations for Next.js, React, Supabase and Node types: passed with zero diagnostics. This is not a replacement for the real dependency-backed TypeScript check.
- Local staff-auth smoke tests: scrypt password round-trip, rejection of an incorrect password, role-permission boundaries, signed session decoding and suspended-account rejection passed.
- Package, Vercel and TypeScript configuration JSON: parsed successfully.
- Migration scope: confirmed migration 009 creates/alters only `rnx_staff_*` tables and RNX functions/triggers.
- Final replacement archive: 144 files; ZIP integrity passed.

## Not verified

- A dependency-backed `npm run typecheck` and Next.js production build have not been completed in this environment.
- Migration 009 has not been executed against the production Supabase project.
- Staff invitation, login, suspension and role-denial workflows have not been exercised against live Supabase.
- No production deployment has been performed by this package build.

Do not treat this release as production-build verified until Vercel completes the full build and the staff invitation flow is tested against the target Supabase project.
