# RNX staff access control — v1.1.0

## Purpose

The administrator console now supports individually authenticated staff accounts. The environment-password login is retained as an owner-only recovery path so the first owner can migrate without being locked out. Normal staff should sign in with the email address and password they establish from a one-time invitation.

## Roles

| Role | Access |
|---|---|
| Owner | All operations, staff invitations, role assignment, suspension and activity history. |
| Operations administrator | Main operations console, supplier/listing moderation, lead handling, offers, communications, membership operations, notifications and analytics. Cannot manage staff. |
| Finance | Membership requests, quotations, lead-fee reconciliation using anonymised opportunity/payment details, manual payment verification/rejection and aggregate analytics. |
| Support | Customer communications only. The support role does not receive the general operations overview endpoint. |
| Analyst | Aggregate acquisition analytics only; no customer or supplier contact records are returned by the analytics endpoint. |

Permissions are enforced by server-side API handlers and server-rendered page checks. Hiding a link is not treated as security. Every staff session is checked against the active staff record in Supabase; a suspended or removed database account cannot continue using its existing cookie.

## Invitation procedure

1. The owner signs in using the recovery password or an owner staff account.
2. Open `/admin/staff` and enter the staff email and role.
3. RNX creates a 48-hour, single-use invitation URL. Only the token hash is stored in Supabase.
4. Copy the URL immediately and share it privately with the intended person. This release does not send staff invitations by email automatically.
5. The invitee opens the link, enters their name and creates a password with at least 12 characters, including an upper-case letter, a lower-case letter and a number.
6. Acceptance is handled by a database function in one transaction. The new staff session is signed, HttpOnly, Secure in production and expires after eight hours.

If an invitation expires, create another. Creating a fresh invitation revokes older unaccepted invitations for that same email address.

## Account administration

The owner can change a staff role or suspend/restore an account in `/admin/staff`. Changes apply to the next protected request because the session resolves the current database role and status on each request. Staff cannot change their own role or suspend their own account from the console. The database prevents demoting or suspending the last active staff owner.

The owner-only screen includes recent staff logins, invitation activity, access changes and selected operational actions. Finance users work from `/admin/memberships` and `/admin/finance`; the lead-fee finance endpoint deliberately omits customer names, phone numbers and email addresses. The activity stream is designed for accountability, not employee surveillance; this release does not collect IP addresses, keystrokes, device fingerprints or browsing histories.

## Database

Apply `009_rnx_staff_access_control.sql` only after confirming migrations 001–008 are present. It creates only:

- `rnx_staff_users`
- `rnx_staff_invitations`
- `rnx_staff_activity`
- `rnx_accept_staff_invitation(...)`
- `rnx_guard_last_active_staff_owner()` and its trigger

All staff tables have RLS enabled, direct `anon` and `authenticated` access revoked, and server-side `service_role` grants only. The invitation-acceptance function is executable only by `service_role`.

## Environment variables

Existing variables remain. `RNX_ADMIN_EMAIL` is optional and labels the emergency owner recovery account in records; the account's access is still controlled by `RNX_ADMIN_PASSWORD` and `RNX_ADMIN_SESSION_SECRET`. Keep these variables server-only. Do not place them in `NEXT_PUBLIC_` variables or GitHub.

## Limitations

- Staff invitation links are copied and delivered manually; staff-email delivery is not included.
- Password reset and self-service recovery are not included. An owner must suspend an account and issue a new invitation if the staff member loses access.
- There is no MFA in this version. Restrict the owner recovery password and Vercel/Supabase project access carefully.
- Staff activity records are best-effort audit entries; if the audit insert fails, the underlying business operation may still succeed. Review the activity table and logs rather than treating it as an immutable regulatory audit archive.
- The first owner continues to use the environment-password recovery route unless an owner staff account is invited and activated.
