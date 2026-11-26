RUFFNECK EXCHANGE v3.11.0 — COMPLETE CUMULATIVE REPLACEMENT

This ZIP contains the complete cumulative RuffNeck Exchange source project, not an incremental overlay. It is based on the v3.10.0 source archive and retains all previously delivered features.

DEPLOYMENT
1. Extract this ZIP.
2. Open the included `ruffneck exchange` folder.
3. Replace the contents of the existing GitHub repository with the full contents of that folder.
4. Commit to the main branch and let the existing Vercel project deploy.

SUPABASE
Existing project: RuffNeck Entertainment.
Apply only `supabase/migrations/029_rnx_supplier_trust_case_responses.sql` after confirming migrations 001–028 are applied. Do not rerun earlier migrations.

NEW IN v3.11.0 — SUPPLIER TRUST-CASE RESPONSE CENTRE
RNX Operations can move a supplier-linked case to Awaiting supplier. The assigned supplier receives an in-app notification and can submit a factual case response from the private supplier dashboard. The response is customer-visible, attributed to the supplier account and moves the case to Under review. Internal RNX notes remain hidden.

No new Vercel environment variables, third-party services, storage buckets or payment integrations are required. Vercel must verify full TypeScript checking and the Next.js production build after deployment.
