# Vercel deployment guide

## Project settings
- Framework: Next.js.
- Root Directory: `./`.
- Build Command: `npm run build` (default Next.js build is also valid).
- Node.js: use the version selected in the Vercel project. Node.js 22 LTS or newer is supported by the package engine declaration.

## Environment variables
Set in Vercel Project Settings → Environment Variables:
- `NEXT_PUBLIC_SITE_URL` = `https://ruffneck-exchange.vercel.app`
- `SUPABASE_URL` = existing approved Supabase project URL
- `SUPABASE_SECRET_KEY` = server-only Supabase secret key

Do not paste secret values into source files, GitHub, browser code or variables prefixed with `NEXT_PUBLIC_`.

## Supabase caution
RNX uses only the `rnx_*` tables. Confirm the target project and existing RNX schema before applying anything. If `001_rnx_core.sql` has not been applied, review and apply it first; if the four core RNX tables already exist, apply only `002_rnx_catalogue.sql`. Do not rerun migration 001 blindly. Do not alter RuffNeck Entertainment LMS, Social Hub, billing, product or profile tables. The catalogue migration adds `public_slug` to `rnx_supplier_applications` and creates `rnx_listings` only. The migration is additive but still requires review against the actual target project.

## Deployment check
1. Confirm a new deployment was created from the latest `main` commit.
2. Wait for `npm run build` to complete and inspect the complete log if it fails.
3. Check homepage, marketplace, request page and business registration page.
4. Submit a test request and confirm the row is stored in `rnx_leads`.
5. Submit a test business application and confirm the row is stored in `rnx_supplier_applications`.
6. Confirm no contact details are exposed on public pages.

A successful Git connection is not proof of a successful build. The message `A repository ID is required for GitHub deployments` is a Vercel Git integration issue, not a Next.js source compilation message.
