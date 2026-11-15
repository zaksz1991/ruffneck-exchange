-- RuffNeck Exchange v1.3.0 — supplier verification and private evidence vault.
-- Additive RNX-only migration. Requires migrations 001–010.
-- Evidence files are stored in a private Supabase Storage bucket. No direct
-- anon/authenticated object access is granted; application routes use the
-- server-side Supabase secret key and issue short-lived signed URLs only after
-- verifying supplier ownership or staff permissions.

alter table public.rnx_supplier_applications
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_last_reviewed_at timestamptz;

alter table public.rnx_supplier_applications
  drop constraint if exists rnx_supplier_verification_status_check;
alter table public.rnx_supplier_applications
  add constraint rnx_supplier_verification_status_check
  check (verification_status in ('unverified','draft','submitted','under_review','verified','rejected','expired'));

create table if not exists public.rnx_supplier_verifications (
  id uuid primary key default gen_random_uuid(),
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  verification_type text not null check (verification_type in ('registered_business','sole_trader','licensed_provider')),
  registered_business_name text not null check (char_length(registered_business_name) between 2 and 180),
  registration_number text check (registration_number is null or char_length(registration_number) between 2 and 80),
  country text not null default 'Nigeria' check (char_length(country) between 2 and 80),
  operating_state text not null check (char_length(operating_state) between 2 and 80),
  website text,
  supplier_statement text not null check (char_length(supplier_statement) between 20 and 1800),
  declaration_accepted_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','verified','rejected','expired')),
  supplier_message text,
  internal_review_note text,
  reviewer_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rnx_supplier_verifications_supplier_created_idx
  on public.rnx_supplier_verifications(supplier_application_id, created_at desc);
create index if not exists rnx_supplier_verifications_status_created_idx
  on public.rnx_supplier_verifications(status, submitted_at asc);
create unique index if not exists rnx_supplier_verifications_one_open_uidx
  on public.rnx_supplier_verifications(supplier_application_id)
  where status in ('draft','submitted','under_review');

create table if not exists public.rnx_supplier_verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.rnx_supplier_verifications(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  document_type text not null check (document_type in (
    'business_registration','proof_of_address','operating_license','business_evidence','authority_letter','tax_registration','other'
  )),
  original_file_name text not null check (char_length(original_file_name) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 4194304),
  review_status text not null default 'uploaded' check (review_status in ('uploaded','accepted','rejected')),
  review_note text,
  reviewed_by uuid references public.rnx_staff_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (verification_id, storage_path)
);
create index if not exists rnx_supplier_verification_docs_request_idx
  on public.rnx_supplier_verification_documents(verification_id, created_at asc);
create index if not exists rnx_supplier_verification_docs_supplier_idx
  on public.rnx_supplier_verification_documents(supplier_application_id, created_at desc);

create table if not exists public.rnx_supplier_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.rnx_supplier_verifications(id) on delete cascade,
  actor_role text not null check (actor_role in ('supplier','staff','system')),
  actor_supplier_id uuid references public.rnx_supplier_applications(id) on delete set null,
  actor_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  actor_email text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rnx_supplier_verification_events_created_idx
  on public.rnx_supplier_verification_events(verification_id, created_at desc);

alter table public.rnx_supplier_verifications enable row level security;
alter table public.rnx_supplier_verification_documents enable row level security;
alter table public.rnx_supplier_verification_events enable row level security;
revoke all on public.rnx_supplier_verifications from anon, authenticated;
revoke all on public.rnx_supplier_verification_documents from anon, authenticated;
revoke all on public.rnx_supplier_verification_events from anon, authenticated;
grant all on public.rnx_supplier_verifications to service_role;
grant all on public.rnx_supplier_verification_documents to service_role;
grant all on public.rnx_supplier_verification_events to service_role;

-- The bucket is created/normalised through the Supabase Storage API by a
-- server-only helper. This migration adds a restrictive bucket-specific policy
-- so even a broad permissive policy created by another app in this shared
-- Supabase project cannot expose these evidence objects to browser roles.
-- Supabase service-role/secret keys bypass Storage RLS and remain server-only.
drop policy if exists rnx_supplier_verification_block_browser_access on storage.objects;
create policy rnx_supplier_verification_block_browser_access
  on storage.objects as restrictive
  for all to public
  using (bucket_id <> 'rnx-supplier-verification')
  with check (bucket_id <> 'rnx-supplier-verification');

comment on table public.rnx_supplier_verifications is 'Private supplier verification submissions; approval is a limited RNX review and not a guarantee of product quality or legal compliance.';
comment on table public.rnx_supplier_verification_documents is 'Private evidence metadata; object bytes are stored in the non-public rnx-supplier-verification bucket.';
