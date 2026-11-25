RUFFNECK EXCHANGE v3.7.0 — APPLY INSTRUCTIONS

GitHub repository: https://github.com/zaksz1991/ruffneck-exchange
Branch: main
Production: https://ruffneck-exchange.vercel.app/
Supabase project: RuffNeck Entertainment
Vercel Root Directory: ./

1. Confirm Supabase migrations 001–026 have already succeeded.
2. Apply only supabase/migrations/027_rnx_commercial_quote_attachments.sql.
3. Extract the complete replacement ZIP and open the included `ruffneck exchange` folder.
4. Replace the existing GitHub repository contents with the complete contents of that folder.
5. Commit to main and allow the existing Vercel project to deploy.

The private quotation attachment bucket is provisioned automatically on the first valid upload. No new Vercel environment variables or external services are required.

See APPLY-v3.7.0.txt and BUILD_STATUS.md for deployment and validation details.
