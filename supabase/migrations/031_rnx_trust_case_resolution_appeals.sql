-- RuffNeck Exchange v3.13.0: customer resolution review and appeal workflow.
-- ADDITIVE ONLY. Requires the cumulative RNX schema through migration 030.
-- Customers can request one review of a resolved/closed case within 14 days.
-- Accepting an appeal reopens the case for renewed Operations review; it is not a liability finding.

alter table public.rnx_trust_cases
  add column if not exists resolution_published_at timestamptz;

-- Older terminal cases did not store a dedicated customer-resolution timestamp.
-- Backfill using the best available historic timestamp without changing case status or content.
update public.rnx_trust_cases
set resolution_published_at = coalesce(resolved_at, closed_at, updated_at, created_at)
where status in ('resolved','closed')
  and resolution_published_at is null;

create or replace function public.rnx_stamp_trust_case_resolution_time()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('resolved','closed') and old.status is distinct from new.status then
    new.resolution_published_at := coalesce(new.resolution_published_at, now());
  elsif new.status not in ('resolved','closed') and old.status in ('resolved','closed') then
    new.resolution_published_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.rnx_stamp_trust_case_resolution_time() from public, anon, authenticated;
drop trigger if exists rnx_stamp_trust_case_resolution_time on public.rnx_trust_cases;
create trigger rnx_stamp_trust_case_resolution_time
  before update of status on public.rnx_trust_cases
  for each row execute function public.rnx_stamp_trust_case_resolution_time();

create table if not exists public.rnx_trust_case_appeals (
  id uuid primary key default gen_random_uuid(),
  trust_case_id uuid not null unique references public.rnx_trust_cases(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','accepted','not_upheld')),
  customer_reason text not null check (char_length(trim(customer_reason)) between 20 and 2000),
  original_case_status text not null check (original_case_status in ('resolved','closed')),
  original_resolution_published_at timestamptz not null,
  staff_response text check (staff_response is null or char_length(staff_response) <= 1800),
  reviewed_by uuid references public.rnx_staff_users(id) on delete set null,
  reviewer_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rnx_trust_case_appeal_review_consistency check (
    (status = 'submitted' and reviewed_at is null and staff_response is null)
    or (status in ('accepted','not_upheld') and reviewed_at is not null and staff_response is not null)
  )
);

create index if not exists rnx_trust_case_appeals_status_created_idx
  on public.rnx_trust_case_appeals(status, created_at desc);

alter table public.rnx_trust_case_appeals enable row level security;
revoke all on public.rnx_trust_case_appeals from public, anon, authenticated;
grant all on public.rnx_trust_case_appeals to service_role;

create or replace function public.rnx_submit_trust_case_appeal(
  p_case_id uuid,
  p_customer_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.rnx_trust_cases%rowtype;
  v_appeal_id uuid;
begin
  if p_customer_reason is null or char_length(trim(p_customer_reason)) < 20 or char_length(trim(p_customer_reason)) > 2000 then
    raise exception 'TRUST_CASE_APPEAL_REASON_INVALID';
  end if;

  select * into v_case
  from public.rnx_trust_cases
  where id = p_case_id
  for update;
  if not found then raise exception 'TRUST_CASE_NOT_FOUND'; end if;
  if v_case.status not in ('resolved','closed') or coalesce(trim(v_case.public_resolution), '') = '' then
    raise exception 'TRUST_CASE_NOT_RESOLVED';
  end if;
  if v_case.resolution_published_at is null then
    raise exception 'TRUST_CASE_RESOLUTION_DATE_MISSING';
  end if;
  if now() > v_case.resolution_published_at + interval '14 days' then
    raise exception 'TRUST_CASE_APPEAL_WINDOW_EXPIRED';
  end if;
  if exists (select 1 from public.rnx_trust_case_appeals where trust_case_id = p_case_id) then
    raise exception 'TRUST_CASE_APPEAL_EXISTS';
  end if;

  insert into public.rnx_trust_case_appeals (
    trust_case_id, status, customer_reason, original_case_status, original_resolution_published_at
  ) values (
    p_case_id, 'submitted', trim(p_customer_reason), v_case.status, v_case.resolution_published_at
  ) returning id into v_appeal_id;

  insert into public.rnx_trust_case_events (
    trust_case_id, actor_role, event_type, from_status, to_status, details
  ) values (
    p_case_id, 'customer', 'appeal_submitted', v_case.status, v_case.status,
    jsonb_build_object('appeal_id', v_appeal_id, 'review_window_days', 14)
  );

  update public.rnx_trust_cases set updated_at = now() where id = p_case_id;
  update public.rnx_leads set last_activity_at = now() where id = v_case.lead_id;
  return v_appeal_id;
end;
$$;

revoke all on function public.rnx_submit_trust_case_appeal(uuid, text) from public, anon, authenticated;
grant execute on function public.rnx_submit_trust_case_appeal(uuid, text) to service_role;

create or replace function public.rnx_review_trust_case_appeal(
  p_case_id uuid,
  p_staff_id uuid,
  p_reviewer_email text,
  p_decision text,
  p_staff_response text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appeal public.rnx_trust_case_appeals%rowtype;
  v_case public.rnx_trust_cases%rowtype;
  v_appeal_id uuid;
  v_from_status text;
  v_to_status text;
begin
  if p_decision is null or p_decision not in ('accepted','not_upheld') then
    raise exception 'TRUST_CASE_APPEAL_DECISION_INVALID';
  end if;
  if p_staff_response is null or char_length(trim(p_staff_response)) < 10 or char_length(trim(p_staff_response)) > 1800 then
    raise exception 'TRUST_CASE_APPEAL_RESPONSE_INVALID';
  end if;

  select * into v_appeal
  from public.rnx_trust_case_appeals
  where trust_case_id = p_case_id
  for update;
  if not found then raise exception 'TRUST_CASE_APPEAL_NOT_FOUND'; end if;
  if v_appeal.status <> 'submitted' then raise exception 'TRUST_CASE_APPEAL_ALREADY_REVIEWED'; end if;

  select * into v_case
  from public.rnx_trust_cases
  where id = p_case_id
  for update;
  if not found then raise exception 'TRUST_CASE_NOT_FOUND'; end if;

  v_from_status := v_case.status;
  v_to_status := v_case.status;

  update public.rnx_trust_case_appeals
  set status = p_decision,
      staff_response = trim(p_staff_response),
      reviewed_by = p_staff_id,
      reviewer_email = nullif(lower(trim(p_reviewer_email)), ''),
      reviewed_at = now(),
      updated_at = now()
  where id = v_appeal.id
    and status = 'submitted'
  returning id into v_appeal_id;
  if v_appeal_id is null then raise exception 'TRUST_CASE_APPEAL_ALREADY_REVIEWED'; end if;

  if p_decision = 'accepted' then
    update public.rnx_trust_cases
    set status = 'under_review',
        resolved_at = null,
        closed_at = null,
        resolution_published_at = null,
        updated_at = now()
    where id = p_case_id;
    v_to_status := 'under_review';
  end if;

  insert into public.rnx_trust_case_events (
    trust_case_id, actor_role, actor_staff_id, actor_email,
    event_type, from_status, to_status, details
  ) values (
    p_case_id, 'staff', p_staff_id, nullif(lower(trim(p_reviewer_email)), ''),
    'appeal_reviewed', v_from_status, v_to_status,
    jsonb_build_object('appeal_id', v_appeal_id, 'decision', p_decision)
  );

  update public.rnx_trust_cases set updated_at = now() where id = p_case_id;
  update public.rnx_leads set last_activity_at = now() where id = v_case.lead_id;
  return v_appeal_id;
end;
$$;

revoke all on function public.rnx_review_trust_case_appeal(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.rnx_review_trust_case_appeal(uuid, uuid, text, text, text) to service_role;

comment on table public.rnx_trust_case_appeals is
  'One customer appeal per resolved/closed RNX trust case. Requests are accepted within 14 days of the published resolution; an accepted appeal reopens the case for Operations review.';
comment on column public.rnx_trust_cases.resolution_published_at is
  'Timestamp used to calculate the customer 14-day resolution appeal window.';
