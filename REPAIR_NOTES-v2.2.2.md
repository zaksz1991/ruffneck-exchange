# v2.2.2 production build repair

The Vercel log for commit `3b638b1` showed a second TypeScript error at `app/api/supplier/listings/[id]/route.ts:84`: Supabase returns a `PromiseLike<void>`, so chaining `.catch()` after `.then()` is invalid. The same invalid pattern also existed in the adjacent pause/resubmit audit insert. Both paths are repaired in this release using awaited Supabase inserts isolated in `try/catch`.

The v2.2.1 image-upload audit fix remains in place. No database migration or environment change is required.
