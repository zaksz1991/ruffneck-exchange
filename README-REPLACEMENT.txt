RUFFNECK EXCHANGE v1.3.0 — COMPLETE REPLACEMENT

1. Download and extract the ZIP.
2. Open the extracted ruffneck-exchange folder.
3. In the existing GitHub repository zaksz1991/ruffneck-exchange, replace the repository contents with the contents of this folder. Preserve all folders and dotfiles. Do not upload the outer ZIP folder as an extra nested directory.
4. Commit the replacement to the existing main branch.
5. Keep the existing Vercel project, production domain https://ruffneck-exchange.vercel.app/ and Root Directory ./ .
6. Confirm migrations 001–010 have succeeded in the intended RuffNeck Entertainment Supabase project, then apply only supabase/migrations/011_rnx_supplier_verification.sql. If 011 was already applied, do not rerun it.
7. Keep existing server-side Supabase credentials and all current session, staff, notification and cron environment variables. No new Vercel environment variables are required.
8. After Vercel reports Ready, sign into an approved supplier portal, save a verification draft, upload synthetic PDF/image evidence and submit it. Then sign in as Owner or Operations Administrator, open /admin/verification, review the evidence and verify the public badge appears only after approval with a future expiry.

This is a complete cumulative repository replacement, not a patch. The new v1.3.0 capability is manual supplier documentary verification with private evidence storage and expiry-controlled public status. It does not automatically contact CAC, FIRS or professional regulators and is not a legal certification. The assistant has not committed to GitHub, applied Supabase migration 011 or deployed to Vercel. Syntax and temporary-shim TypeScript checks passed; a real dependency-backed production build remains unverified because dependency installation timed out.
