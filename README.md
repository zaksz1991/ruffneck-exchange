# RuffNeck Exchange (RNX) — v0.2.0

RuffNeck Exchange is a multi-industry, multi-location customer-acquisition marketplace. It is not a directory and is not limited to refrigeration, solar or any single vertical.

**Brand:** RuffNeck Exchange (RNX)  
**Production domain:** https://ruffneck-exchange.vercel.app/  
**Positioning:** Products. Services. Businesses. Opportunities.

## Business model

1. A customer discovers RNX and submits a free product, service, wholesale or procurement request.
2. RNX reviews the request for clarity, location, contactability and permission.
3. Where relevant, suppliers may receive an anonymised opportunity brief.
4. Supplier participation and any applicable lead fee are governed by separate terms.
5. Customer permission is obtained before contact details are released or an introduction is made.
6. Outcomes, duplicate requests and disputes are reviewed and recorded.

Never sell customer contact details without clear disclosure and permission. Never claim a supplier is verified until the required checks have actually been completed. A membership or payment does not guarantee leads, ranking or sales.

## Included in this complete project

- Responsive Next.js application and global styling.
- RNX home page and 14 industry departments.
- Category search and state selector (taxonomy matching, not live stock search).
- Customer sourcing request form with server-side validation.
- Supplier application form with server-side validation.
- Server-only Supabase persistence routes.
- Additive `rnx_*` database migration with RLS and revoked browser-role access.
- RuffNeck Entertainment product showcase.
- About, how-it-works, privacy and terms draft pages.
- Metadata, canonical URL, robots and sitemap.
- Vercel configuration and environment-variable example.

## Not yet implemented

This release does **not** include self-service authentication, member dashboards, listing CRUD, live product inventory, supplier search by verified stock, subscriptions, payment gateway, admin moderation console, automated matching, email/WhatsApp/Telegram notifications or a complete dispute/refund workflow. Supplier review and lead allocation remain manual. The policy pages are launch drafts and require professional legal review before commercial operation.

## Requirements and setup

- Node.js 20.9 or newer.
- Supabase project with the RNX core migration applied.
- Vercel project connected to `zaksz1991/ruffneck-exchange`.

1. Copy `.env.example` to `.env.local` for local development.
2. Set `NEXT_PUBLIC_SITE_URL=https://ruffneck-exchange.vercel.app`.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-only environment variables. The legacy `SUPABASE_SERVICE_ROLE_KEY` is supported as fallback. Never use a `NEXT_PUBLIC_` prefix for a secret key.
4. Apply `supabase/migrations/001_rnx_core.sql` only if the four RNX tables have not already been created in the approved Supabase project. Do not rerun database changes blindly or modify unrelated RuffNeck tables.
5. Install dependencies with your package manager.
6. Run `npm run build` to verify the production build.

## Vercel settings

- Framework preset: Next.js.
- Root Directory: `./`.
- Build command: `next build` (the package script is `npm run build`).
- Production URL: `https://ruffneck-exchange.vercel.app`.
- Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel Environment Variables as server-only values.

This project does not require a Supabase Vercel marketplace integration when reusing an existing Supabase project. Do not add a new Supabase project just to deploy RNX.

## Verification status

Source files and archive structure are included in this package. A full dependency installation, `next build`, live form submission and live Supabase write have not been run in this environment. Do not interpret a page loading as proof that database submissions work.
