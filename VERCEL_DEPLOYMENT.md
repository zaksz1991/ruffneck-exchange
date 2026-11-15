# Vercel deployment (GUI workflow)

1. Create a GitHub repository named `ruffneck-exchange`.
2. Upload the contents of this project to the repository root using GitHub's web interface.
3. In Vercel, select **Add New → Project**, import `ruffneck-exchange`, keep framework preset **Next.js**.
4. Add environment variables from `.env.example` in Project Settings → Environment Variables. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never use a `NEXT_PUBLIC_` prefix.
5. In Supabase SQL Editor, review and run `supabase/migrations/001_rnx_core.sql` in the correct project.
6. Deploy a Preview first. Test customer and supplier forms, confirm rows are stored and check that public/anon roles cannot read private leads.
7. Set `NEXT_PUBLIC_SITE_URL` to the actual production domain, redeploy, then test metadata, sitemap and robots.
8. Add the production domain to Google Search Console and submit `/sitemap.xml`.

Commercial-use restriction: Vercel Hobby is restricted to personal, non-commercial use. Since RNX is intended to earn revenue, do not treat Hobby as an eligible free production tier. Review current Vercel plan terms before monetised launch. Development previews are not a workaround for commercial production.

No paid subscription is assumed in this project. This is source code and setup guidance; no live Supabase, email, payments, domain, or Vercel deployment has been connected by this ZIP.
