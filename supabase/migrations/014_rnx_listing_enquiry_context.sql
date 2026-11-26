-- RuffNeck Exchange v2.0.0: retain the exact published offer a customer enquired about.
-- Additive RNX-only migration. Requires migrations 001–013, including rnx_listings.
-- Existing customer requests remain unchanged; browser roles retain no direct table access.

alter table public.rnx_leads
  add column if not exists referenced_listing_id uuid
    references public.rnx_listings(id) on delete set null,
  add column if not exists referenced_listing_slug text,
  add column if not exists referenced_listing_title text,
  add column if not exists referenced_supplier_name text;

create index if not exists rnx_leads_referenced_listing_idx
  on public.rnx_leads(referenced_listing_id, created_at desc)
  where referenced_listing_id is not null;

comment on column public.rnx_leads.referenced_listing_id is
  'Optional approved RNX catalogue listing that initiated the customer enquiry. It does not authorise supplier contact or disclose customer details.';
comment on column public.rnx_leads.referenced_listing_slug is
  'Listing slug snapshot retained for request history if the catalogue listing is later removed.';
comment on column public.rnx_leads.referenced_listing_title is
  'Listing title snapshot captured from the approved catalogue at enquiry time.';
comment on column public.rnx_leads.referenced_supplier_name is
  'Supplier business-name snapshot captured from the approved catalogue at enquiry time.';

-- rnx_leads already has RLS enabled and browser-role access revoked by migrations 001 and 006.
-- No public or authenticated policy is added. Application server access continues via service role.
