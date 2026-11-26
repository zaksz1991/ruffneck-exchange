-- RuffNeck Exchange v1.0.0: consent-first conversion attribution.
-- ADDITIVE ONLY. Depends on RNX migrations 001-007.
-- Adds optional attribution columns to RNX leads and supplier applications,
-- plus non-identifying campaign metadata to RNX event records.

alter table public.rnx_leads
  add column if not exists attribution_source text,
  add column if not exists attribution_medium text,
  add column if not exists attribution_campaign text,
  add column if not exists attribution_referrer_host text,
  add column if not exists attribution_landing_path text,
  add column if not exists attribution_captured_at timestamptz;

alter table public.rnx_supplier_applications
  add column if not exists attribution_source text,
  add column if not exists attribution_medium text,
  add column if not exists attribution_campaign text,
  add column if not exists attribution_referrer_host text,
  add column if not exists attribution_landing_path text,
  add column if not exists attribution_captured_at timestamptz;

alter table public.rnx_events
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists campaign text,
  add column if not exists referrer_host text,
  add column if not exists event_data jsonb not null default '{}'::jsonb;

create index if not exists rnx_leads_attribution_created_idx
  on public.rnx_leads(attribution_source, created_at desc)
  where attribution_source is not null;
create index if not exists rnx_supplier_attribution_created_idx
  on public.rnx_supplier_applications(attribution_source, created_at desc)
  where attribution_source is not null;
create index if not exists rnx_events_consent_type_created_idx
  on public.rnx_events(event_type, created_at desc)
  where consented = true;
create index if not exists rnx_events_campaign_created_idx
  on public.rnx_events(source, campaign, created_at desc)
  where consented = true;

comment on column public.rnx_leads.attribution_source is
  'Optional first-touch acquisition source. Populated only after explicit analytics consent.';
comment on column public.rnx_supplier_applications.attribution_source is
  'Optional first-touch acquisition source. Populated only after explicit analytics consent.';
comment on table public.rnx_events is
  'Private RNX event log. v1.0.0 stores only consented conversion events and non-identifying attribution metadata.';

-- RNX tables remain protected by their existing row-level security policies.
-- No anon/authenticated grants are added. Server-side service credentials only.
