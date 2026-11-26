-- RuffNeck Exchange v2.9.0: private customer request progress timeline.
-- Additive RNX-only migration. Requires RNX migrations 001–006.
-- This migration does NOT reference listing availability or saved-offer columns.

create table if not exists public.rnx_customer_request_activity (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  lead_id uuid not null references public.rnx_leads(id) on delete cascade,
  event_type text not null check (event_type in (
    'request_submitted',
    'status_changed',
    'contact_release_changed'
  )),
  previous_status text,
  new_status text,
  previous_contact_release_status text,
  new_contact_release_status text,
  created_at timestamptz not null default now()
);

create index if not exists rnx_customer_request_activity_customer_created_idx
  on public.rnx_customer_request_activity(customer_id, created_at desc);
create index if not exists rnx_customer_request_activity_lead_created_idx
  on public.rnx_customer_request_activity(lead_id, created_at asc);

alter table public.rnx_customer_request_activity enable row level security;
revoke all on public.rnx_customer_request_activity from public, anon, authenticated;

comment on table public.rnx_customer_request_activity is
  'Private, customer-scoped milestones for signed-in RNX requests. Does not contain staff-only notes or supplier contact details.';

create or replace function public.rnx_capture_customer_request_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.customer_id is distinct from new.customer_id then
      -- If a request is re-linked or detached, remove the previous account's
      -- event history so it cannot remain visible in the former account.
      delete from public.rnx_customer_request_activity
      where lead_id = new.id
        and customer_id is distinct from new.customer_id;

      if new.customer_id is not null then
        insert into public.rnx_customer_request_activity (
          customer_id, lead_id, event_type, new_status,
          new_contact_release_status
        ) values (
          new.customer_id, new.id, 'request_submitted', new.status,
          new.contact_release_status
        );
      end if;
      return new;
    end if;
  end if;

  -- Guest requests are not linked to a customer account and continue to use
  -- their existing private tracking-token workflow.
  if new.customer_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.rnx_customer_request_activity (
      customer_id, lead_id, event_type, new_status,
      new_contact_release_status, created_at
    ) values (
      new.customer_id, new.id, 'request_submitted', new.status,
      new.contact_release_status, coalesce(new.created_at, now())
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.rnx_customer_request_activity (
      customer_id, lead_id, event_type, previous_status, new_status
    ) values (
      new.customer_id, new.id, 'status_changed', old.status, new.status
    );
  end if;

  if new.contact_release_status is distinct from old.contact_release_status then
    insert into public.rnx_customer_request_activity (
      customer_id, lead_id, event_type,
      previous_contact_release_status, new_contact_release_status
    ) values (
      new.customer_id, new.id, 'contact_release_changed',
      old.contact_release_status, new.contact_release_status
    );
  end if;

  return new;
end;
$$;

revoke all on function public.rnx_capture_customer_request_activity() from public, anon, authenticated;
drop trigger if exists rnx_customer_request_activity_capture on public.rnx_leads;
create trigger rnx_customer_request_activity_capture
after insert or update on public.rnx_leads
for each row execute function public.rnx_capture_customer_request_activity();

-- Existing customer-linked requests receive one truthful submission milestone.
-- Historical status transitions are not invented because older changes were not logged.
insert into public.rnx_customer_request_activity (
  customer_id, lead_id, event_type, created_at
)
select lead.customer_id, lead.id, 'request_submitted', lead.created_at
from public.rnx_leads as lead
where lead.customer_id is not null
  and not exists (
    select 1
    from public.rnx_customer_request_activity as activity
    where activity.lead_id = lead.id
      and activity.customer_id = lead.customer_id
      and activity.event_type = 'request_submitted'
  );
