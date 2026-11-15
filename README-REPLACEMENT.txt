RUFFNECK EXCHANGE v0.6.0 — COMPLETE PROJECT REPLACEMENT

This is the entire cumulative project, not a patch. It retains the v0.5.0 marketplace, supplier directory, approved catalogue, moderation, admin operations and paid consent-based introduction workflow. It adds supplier portal accounts, membership plans, supplier opportunity accept/decline, supplier catalogue management and manual membership billing operations with independently recorded bank/provider receipt evidence.

GitHub: zaksz1991/ruffneck-exchange
Branch: main
Vercel Root Directory: ./
Framework: Next.js
Production domain: https://ruffneck-exchange.vercel.app/

Replace the existing repository source files with the contents of this complete project. Keep the repository, Git history and existing Vercel project. Do not create a second Vercel project.

Database: check the applied migration history first. If migrations 001–004 have all been applied, apply only 005_rnx_supplier_memberships_portal.sql. If any earlier migration is missing, apply only missing migrations in numerical order. The new migration alters only existing RNX-prefixed tables and creates RNX-prefixed membership/auth objects. It does not modify unrelated RuffNeck Entertainment tables.

Set SUPABASE_URL, SUPABASE_SECRET_KEY, RNX_ADMIN_PASSWORD, RNX_ADMIN_SESSION_SECRET and NEXT_PUBLIC_SITE_URL privately in Vercel. Set RNX_SUPPLIER_SESSION_SECRET to a separate random secret of at least 32 characters (it falls back to RNX_ADMIN_SESSION_SECRET if omitted). RNX_PAYMENT_INSTRUCTIONS is optional and server-only. Never place secret values or actual bank details in GitHub.

After deployment, use /admin/memberships to quote supplier plans and issue activation links to approved legacy suppliers. The portal is /supplier/login. New applicants choose a password on registration; their portal opens after approval.

This archive does not commit to GitHub, deploy to Vercel, execute SQL, receive payments or send emails/WhatsApp/SMS. See BUILD_STATUS.md, RNX_SUPPLIER_PORTAL.md and VERCEL_DEPLOYMENT.md for migration and verification limits.
