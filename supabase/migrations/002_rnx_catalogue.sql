-- RNX catalogue and public supplier profile layer.
-- Additive only: does not alter unrelated RuffNeck Entertainment tables.
-- Requires 001_rnx_core.sql and the existing public.rnx_supplier_applications table.

alter table public.rnx_supplier_applications
  add column if not exists public_slug text;

create unique index if not exists rnx_supplier_public_slug_uidx
  on public.rnx_supplier_applications(public_slug)
  where public_slug is not null;

create table if not exists public.rnx_listings (
  id uuid primary key default gen_random_uuid(),
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  slug text not null unique,
  listing_type text not null check (listing_type in ('product','service','wholesale','rental')),
  category text not null,
  description text not null check (char_length(description) between 30 and 3000),
  state text not null,
  city text,
  price_type text not null default 'enquiry' check (price_type in ('enquiry','fixed','from')),
  price numeric(14,2) check (price is null or price >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  condition text,
  keywords text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rnx_listing_price_consistency check (
    (price_type = 'enquiry' and price is null) or
    (price_type in ('fixed','from') and price is not null and price > 0)
  )
);

create index if not exists rnx_listings_status_created_idx
  on public.rnx_listings(status, created_at desc);
create index if not exists rnx_listings_category_state_idx
  on public.rnx_listings(category, state);
create index if not exists rnx_listings_supplier_idx
  on public.rnx_listings(supplier_application_id);

alter table public.rnx_listings enable row level security;
revoke all on public.rnx_listings from anon, authenticated;
revoke all on public.rnx_supplier_applications from anon, authenticated;

-- Manual review: approve the supplier application and each listing independently.
-- Public app queries require both statuses to be 'approved'.
