RUFFNECK EXCHANGE v3.6.0 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the full RuffNeck Exchange source project, not an incremental overlay.

DEPLOYMENT
1. Extract this ZIP.
2. Open the included "ruffneck exchange" folder.
3. Replace the contents of the existing GitHub repository with the full contents of that folder.
4. Commit to the main branch and let the existing Vercel project deploy.

SUPABASE
Existing project: RuffNeck Entertainment.
Apply only supabase/migrations/026_rnx_commercial_quote_conversations.sql after confirming migrations 001–025 are already applied.
Do not rerun migrations 001–025.

NEW IN v3.6.0 — PRIVATE COMMERCIAL QUOTATION CONVERSATIONS
Customers and introduced suppliers can exchange private messages on a specific commercial quotation from their respective dashboards. The message thread is accessible only to the customer and supplier recorded on that quotation after RNX contact release. Messages generate generic in-app notifications for the other party. Closed, expired, finalised or disputed transactions are read-only.

No new Vercel environment variables or third-party services are required.
Full TypeScript typechecking and the Next.js production build must be confirmed by Vercel after deployment.
