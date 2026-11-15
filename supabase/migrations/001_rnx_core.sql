-- RuffNeck Exchange core schema. Run in the intended Supabase project after reviewing ownership and RLS.
create extension if not exists pgcrypto;
create table if not exists public.rnx_supplier_applications (
 id uuid primary key default gen_random_uuid(), business_name text not null, contact_name text not null,
 email text not null, phone text not null, business_type text not null, category text not null,
 state text not null, website text, description text not null, consent text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.rnx_leads (
 id uuid primary key default gen_random_uuid(), request_type text not null, name text not null,
 email text, phone text not null, state text not null, city text, category text not null,
 details text not null, preferred_contact text not null, consent text not null,
 status text not null default 'new' check (status in ('new','qualifying','qualified','matched','closed','invalid')),
 contact_release_status text not null default 'locked' check (contact_release_status in ('locked','customer_approved','released')),
 created_at timestamptz not null default now()
);
create table if not exists public.rnx_lead_offers (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.rnx_leads(id) on delete cascade,
 supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
 anonymised_summary text not null, quoted_fee numeric(12,2) not null check (quoted_fee >= 0),
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded','credited')),
 customer_approved_at timestamptz, contact_released_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.rnx_events (
 id uuid primary key default gen_random_uuid(), event_type text not null, path text,
 state text, category text, consented boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists rnx_leads_created_idx on public.rnx_leads(created_at desc);
create index if not exists rnx_leads_state_idx on public.rnx_leads(state);
create index if not exists rnx_supplier_state_idx on public.rnx_supplier_applications(state);
-- RLS: browser roles receive no access. Server routes use service role only.
alter table public.rnx_supplier_applications enable row level security;
alter table public.rnx_leads enable row level security;
alter table public.rnx_lead_offers enable row level security;
alter table public.rnx_events enable row level security;
revoke all on public.rnx_supplier_applications,public.rnx_leads,public.rnx_lead_offers,public.rnx_events from anon, authenticated;
