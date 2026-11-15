RUFFNECK EXCHANGE v0.5.0 — COMPLETE PROJECT REPLACEMENT

This ZIP is the full cumulative project, not a patch. It retains the existing marketplace, supplier directory, catalogue, request forms and operator console, and adds the supplier introduction workflow.

GitHub: zaksz1991/ruffneck-exchange
Branch: main
Vercel Root Directory: ./
Framework: Next.js
Production domain: https://ruffneck-exchange.vercel.app/

Replace the repository source files with the contents of this project folder. Keep repository settings, Git history and the existing Vercel project. Do not create a second Vercel project.

Database: if migrations 001, 002 and 003 are already applied, apply only 004_rnx_introduction_workflow.sql. Check migration history first. The migration creates only RNX-prefixed columns, tables and functions. Do not change other RuffNeck Entertainment tables.

Set SUPABASE_URL, SUPABASE_SECRET_KEY, RNX_ADMIN_PASSWORD, RNX_ADMIN_SESSION_SECRET and NEXT_PUBLIC_SITE_URL privately in Vercel. Never put secrets in GitHub.

The archive does not commit to GitHub, deploy to Vercel, execute SQL or connect a payment/messaging provider. See BUILD_STATUS.md and RNX_INTRODUCTION_WORKFLOW.md for verification status and operating rules.
