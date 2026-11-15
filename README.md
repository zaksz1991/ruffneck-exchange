# RuffNeck Exchange (RNX) — v0.1.0

A multi-industry, multi-location customer-acquisition marketplace. Refrigeration, cold rooms and solar are categories only; they do not define the brand.

## Business model: RNX is the intermediary
1. Customer discovers RNX through organic search, referrals, social distribution or direct visits.
2. Customer submits a free product/service/wholesale request.
3. RNX staff verify need, budget/timing where relevant, location, contactability and permission.
4. RNX sends matched suppliers an anonymised opportunity summary.
5. Supplier accepts the fee/terms and pays through the approved payment process.
6. RNX confirms customer permission for the introduction.
7. Only then is customer contact information released to the paying supplier.
8. Outcome, dispute, duplicate and refund/credit status are tracked.

Never sell customer contact details without clear disclosure and permission. Never claim supplier verification until checks are completed. Membership payment does not guarantee leads or ranking.

## Run locally
1. Install Node.js 22 LTS or newer.
2. In the project folder, install dependencies using your package manager.
3. Copy `.env.example` to `.env.local`.
4. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-only environment variables. Never expose the secret key with a `NEXT_PUBLIC_` prefix. The legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported temporarily as a fallback.
5. Apply `supabase/migrations/001_rnx_core.sql` to a new or approved schema in Supabase.
6. Start the Next.js development server.

## Vercel
Import the GitHub repository into Vercel as a Next.js project. Configure environment variables in Vercel Project Settings. Deploy a preview first, test forms, then promote to production. Do not use Netlify Functions.

Important: Vercel Hobby is for non-commercial personal use. This is a revenue-generating business concept; confirm an appropriate Vercel plan before commercial production. No paid plan or free commercial entitlement is assumed.

## Included
- Responsive landing page, department taxonomy and state index.
- Marketplace location/category page template with an explicit thin-content safeguard.
- Customer request and supplier application forms.
- Server-side validation and Supabase persistence routes.
- Lead status and contact-release lock schema.
- RuffNeck seller showcase and official platform links.
- Metadata, canonical base configuration, robots and sitemap.

## Not yet included / do not misrepresent
- No self-service login, member dashboard, listing CRUD, subscriptions, payment gateway, admin interface, live email/WhatsApp/Telegram notifications, supplier verification workflow, product inventory sync or automated lead allocation.
- Lead routing and payments are deliberately manual at launch until demand and supplier willingness-to-pay are validated.
- Visitor analytics are not enabled by default; add consent management before analytics tracking.
- State/category routes are templates, not publish-ready SEO pages until each has unique researched copy and verified suppliers.

## SEO operating rules
- Research exact keyword demand with Google Keyword Planner/Search Console; do not fabricate volume or difficulty.
- Build pages around distinct search intent: product, service, supplier, quote, repair, wholesale, rental, spare part and location.
- Only index pages with unique useful content, local proof, real inventory or verified supplier coverage. No mass-generated doorway pages.
- Add product/service schema only for genuine visible listings; add LocalBusiness only with accurate business details and permission.
- Use descriptive titles, unique meta descriptions, clean URLs, breadcrumbs, internal links, image alt text, fast mobile pages, sitemap and Search Console.
- Track impressions, clicks, calls, WhatsApp clicks, form starts, completed leads, qualified leads, paid introductions and supplier close rates.
