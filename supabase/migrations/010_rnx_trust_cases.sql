-- RuffNeck Exchange v1.2.0: customer complaints, disputes and resolution workflow.
-- ADDITIVE ONLY. Requires RNX migrations 001-009. Creates only rnx_* objects.

create sequence if not exists public.rnx_trust_case_reference_seq;

create table if not exists public.rnx_trust_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique default ('RNX-CASE-' || lpad(nextval('public.rnx_trust_case_reference_seq')::text, 8, '0')),
  lead_id uuid not null references public.rnx_leads(id) on delete cascade,
  lead_offer_id uuid references public.rnx_lead_offers(id) on delete set null,
  supplier_application_id uuid references public.rnx_supplier_applications(id) on delete set null,
  case_type text not null check (case_type in ('general_complaint','delivery_issue','product_quality','service_quality','payment_dispute','supplier_conduct','suspected_fraud','other')),
  summary text not null check (char_length(trim(summary)) between 5 and 160),
  description text not null check (char_length(trim(description)) between 20 and 4000),
  requested_resolution text check (requested_resolution is null or char_length(requested_resolution) <= 1200),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  status text not null default 'new' check (status in ('new','triaged','awaiting_customer','awaiting_supplier','under_review','resolved','closed')),
  public_resolution text check (public_resolution is null or char_length(public_resolution) <= 1800),
  assigned_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create index if not exists rnx_trust_cases_status_created_idx
  on public.rnx_trust_cases(status, created_at desc);
create index if not exists rnx_trust_cases_lead_created_idx
  on public.rnx_trust_cases(lead_id, created_at desc);
create index if not exists rnx_trust_cases_assigned_status_idx
  on public.rnx_trust_cases(assigned_staff_id, status, updated_at desc);
create index if not exists rnx_trust_cases_supplier_created_idx
  on public.rnx_trust_cases(supplier_application_id, created_at desc)
  where supplier_application_id is not null;

create table if not exists public.rnx_trust_case_messages (
  id uuid primary key default gen_random_uuid(),
  trust_case_id uuid not null references public.rnx_trust_cases(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','staff')),
  sender_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  sender_name text not null,
  visibility text not null default 'customer' check (visibility in ('customer','internal')),
  body text not null check (char_length(trim(body)) between 2 and 3000),
  created_at timestamptz not null default now(),
  constraint rnx_trust_case_message_sender_consistency check (
    (sender_role = 'customer' and sender_staff_id is null and visibility = 'customer') or
    (sender_role = 'staff')
  )
);

create index if not exists rnx_trust_case_messages_case_created_idx
  on public.rnx_trust_case_messages(trust_case_id, created_at asc);

create table if not exists public.rnx_trust_case_events (
  id uuid primary key default gen_random_uuid(),
  trust_case_id uuid not null references public.rnx_trust_cases(id) on delete cascade,
  actor_role text not null check (actor_role in ('customer','staff','system')),
  actor_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  actor_email text,
  event_type text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rnx_trust_case_events_case_created_idx
  on public.rnx_trust_case_events(trust_case_id, created_at desc);

alter table public.rnx_trust_cases enable row level security;
alter table public.rnx_trust_case_messages enable row level security;
alter table public.rnx_trust_case_events enable row level security;
revoke all on public.rnx_trust_cases, public.rnx_trust_case_messages, public.rnx_trust_case_events from public, anon, authenticated;
grant all on public.rnx_trust_cases, public.rnx_trust_case_messages, public.rnx_trust_case_events to service_role;
revoke all on sequence public.rnx_trust_case_reference_seq from public, anon, authenticated;
grant usage, select on sequence public.rnx_trust_case_reference_seq to service_role;

comment on table public.rnx_trust_cases is 'RNX-only customer complaint and dispute cases. Access is server-only through request tracking tokens or authorised staff.';
comment on table public.rnx_trust_case_messages is 'RNX trust-case conversation. Internal notes are never returned to customers.';
comment on table public.rnx_trust_case_events is 'Append-only status and handling history for RNX trust cases.';
