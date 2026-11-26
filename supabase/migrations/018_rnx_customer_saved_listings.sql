-- RuffNeck Exchange v2.5.0: customer saved marketplace offers.
-- Additive only. Apply after RNX migrations 001–017 in the existing RNX Supabase project.
-- Saved offers are private to the customer who saved them; no public table access is granted.

create table if not exists public.rnx_customer_saved_listings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  listing_id uuid not null references public.rnx_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint rnx_customer_saved_listings_customer_listing_key unique (customer_id, listing_id)
);

create index if not exists rnx_customer_saved_listings_customer_created_idx
  on public.rnx_customer_saved_listings(customer_id, created_at desc);
create index if not exists rnx_customer_saved_listings_listing_idx
  on public.rnx_customer_saved_listings(listing_id);

alter table public.rnx_customer_saved_listings enable row level security;
revoke all on public.rnx_customer_saved_listings from public, anon, authenticated;

-- Keep the saved list limited to offers that are public at the time they are saved.
-- The application also rechecks listing and supplier approval on every read.
create or replace function public.rnx_guard_customer_saved_listing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.rnx_listings l
    join public.rnx_supplier_applications s on s.id = l.supplier_application_id
    where l.id = new.listing_id
      and l.status = 'approved'
      and s.status = 'approved'
      and s.public_slug is not null
  ) then
    raise exception 'Only currently published RNX listings can be saved.';
  end if;
  return new;
end;
$$;

revoke all on function public.rnx_guard_customer_saved_listing() from public, anon, authenticated;
drop trigger if exists rnx_customer_saved_listing_publication_guard on public.rnx_customer_saved_listings;
create trigger rnx_customer_saved_listing_publication_guard
before insert or update of listing_id on public.rnx_customer_saved_listings
for each row execute function public.rnx_guard_customer_saved_listing();

comment on table public.rnx_customer_saved_listings is
  'Private customer bookmarks for published RuffNeck Exchange marketplace listings.';
