# RuffNeck Exchange v3.15.0 — Supplier catalogue CSV import

- Suppliers can import up to 25 catalogue listings in one CSV batch from the private supplier dashboard.
- The downloadable UTF-8 CSV template includes the required columns for title, listing type, category, description, state, city, pricing type, price and search keywords.
- The API supports standard quoted CSV fields, including commas and escaped double quotes, and rejects malformed quoting, duplicate headers, missing columns, invalid listing types, unsupported states, invalid prices and descriptions outside the existing listing limits.
- The entire file is validated before any database insert. Invalid rows block the whole import and are returned with CSV row numbers; the API does not partially import a file with validation errors.
- Imports are limited to 250 KB and 25 rows per request. Each row is checked against the authenticated supplier and active membership listing limit. All imported offers are stored as `pending` and remain hidden until RNX moderation approves them.
- Imported listing prices use NGN, matching the existing single-listing supplier submission flow. Images are not included; suppliers can add cover and gallery images from the catalogue manager after import.
- Reuses existing `rnx_listings`, supplier authentication and membership tables. No Supabase migration, new environment variable, storage bucket or external service is required. Existing migrations 001–032 remain unchanged.
