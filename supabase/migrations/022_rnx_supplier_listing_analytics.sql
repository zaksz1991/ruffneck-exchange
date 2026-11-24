-- RuffNeck Exchange v3.0.0: consent-based supplier listing performance insights.
-- Additive RNX-only migration. Requires RNX migrations 001, 002, 014 and 018.
-- This migration does not depend on listing availability columns from migration 017.
-- Events contain listing/supplier references and timestamps only; no visitor identity is stored.

create table if not exists public.rnx_listing_view_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rnx_listings(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists rnx_listing_view_events_supplier_created_idx
  on public.rnx_listing_view_events(supplier_application_id, created_at desc);
create index if not exists rnx_listing_view_events_listing_created_idx
  on public.rnx_listing_view_events(listing_id, created_at desc);

alter table public.rnx_listing_view_events enable row level security;
revoke all on public.rnx_listing_view_events from public, anon, authenticated;

create or replace function public.rnx_guard_listing_view_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supplier_id uuid;
begin
  select listing.supplier_application_id
    into v_supplier_id
  from public.rnx_listings as listing
  join public.rnx_supplier_applications as supplier
    on supplier.id = listing.supplier_application_id
  where listing.id = new.listing_id
    and listing.status = 'approved'
    and supplier.status = 'approved'
    and supplier.public_slug is not null;

  if v_supplier_id is null or v_supplier_id is distinct from new.supplier_application_id then
    raise exception 'Listing view events can only be recorded for a currently published listing and its supplier.';
  end if;

  return new;
end;
$$;

revoke all on function public.rnx_guard_listing_view_event() from public, anon, authenticated;
drop trigger if exists rnx_listing_view_event_publication_guard on public.rnx_listing_view_events;
create trigger rnx_listing_view_event_publication_guard
before insert on public.rnx_listing_view_events
for each row execute function public.rnx_guard_listing_view_event();

create or replace function public.rnx_supplier_listing_metrics(p_supplier_application_id uuid)
returns table (
  listing_id uuid,
  views_7d bigint,
  views_30d bigint,
  saves_total bigint,
  enquiries_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with owned_listings as (
    select listing.id
    from public.rnx_listings as listing
    where listing.supplier_application_id = p_supplier_application_id
  ),
  view_counts as (
    select
      events.listing_id,
      count(*) filter (where events.created_at >= now() - interval '7 days') as views_7d,
      count(*) as views_30d
    from public.rnx_listing_view_events as events
    join owned_listings as owned on owned.id = events.listing_id
    where events.supplier_application_id = p_supplier_application_id
      and events.created_at >= now() - interval '30 days'
    group by events.listing_id
  ),
  save_counts as (
    select saved.listing_id, count(*) as saves_total
    from public.rnx_customer_saved_listings as saved
    join owned_listings as owned on owned.id = saved.listing_id
    group by saved.listing_id
  ),
  enquiry_counts as (
    select lead.referenced_listing_id as listing_id, count(*) as enquiries_total
    from public.rnx_leads as lead
    join owned_listings as owned on owned.id = lead.referenced_listing_id
    group by lead.referenced_listing_id
  )
  select
    owned.id as listing_id,
    coalesce(views.views_7d, 0)::bigint as views_7d,
    coalesce(views.views_30d, 0)::bigint as views_30d,
    coalesce(saves.saves_total, 0)::bigint as saves_total,
    coalesce(enquiries.enquiries_total, 0)::bigint as enquiries_total
  from owned_listings as owned
  left join view_counts as views on views.listing_id = owned.id
  left join save_counts as saves on saves.listing_id = owned.id
  left join enquiry_counts as enquiries on enquiries.listing_id = owned.id;
$$;

revoke all on function public.rnx_supplier_listing_metrics(uuid) from public, anon, authenticated;
grant execute on function public.rnx_supplier_listing_metrics(uuid) to service_role;

comment on table public.rnx_listing_view_events is
  'Consent-based detail-view event counts for RNX supplier insights. Stores no visitor account, contact, IP or device identifier.';
comment on function public.rnx_supplier_listing_metrics(uuid) is
  'Returns per-listing aggregate metrics for one supplier. Execute is restricted to the server service role.';
