-- RuffNeck Exchange v3.14.0: first-response service-level tracking for trust cases.
-- ADDITIVE ONLY. Requires the cumulative RNX schema through migration 031.
-- Targets are elapsed-time targets from case submission, not business-hour guarantees.
-- Only the first customer-visible RNX staff reply satisfies the first-response target.
-- Internal notes, customer messages and supplier responses do not count as an RNX response.

alter table public.rnx_trust_cases
  add column if not exists first_response_sla_minutes integer not null default 480,
  add column if not exists first_response_due_at timestamptz,
  add column if not exists first_response_at timestamptz;

-- Validate the stored target range. Re-run safe: the constraint is created only when absent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rnx_trust_cases_first_response_sla_minutes_check'
      and conrelid = 'public.rnx_trust_cases'::regclass
  ) then
    alter table public.rnx_trust_cases
      add constraint rnx_trust_cases_first_response_sla_minutes_check
      check (first_response_sla_minutes between 15 and 4320);
  end if;
end;
$$;

-- Backfill existing records using their current severity and the first recorded public staff reply.
-- This is a reconstruction from available records; it does not claim historical SLA policy existed.
update public.rnx_trust_cases c
set first_response_sla_minutes = case c.severity
      when 'critical' then 60
      when 'high' then 240
      when 'normal' then 480
      when 'low' then 1440
      else 480
    end,
    first_response_due_at = coalesce(
      c.first_response_due_at,
      c.created_at + make_interval(mins => case c.severity
        when 'critical' then 60
        when 'high' then 240
        when 'normal' then 480
        when 'low' then 1440
        else 480
      end)
    ),
    first_response_at = coalesce(
      c.first_response_at,
      (
        select min(m.created_at)
        from public.rnx_trust_case_messages m
        where m.trust_case_id = c.id
          and m.sender_role = 'staff'
          and m.visibility = 'customer'
      )
    );

create index if not exists rnx_trust_cases_response_sla_due_idx
  on public.rnx_trust_cases(first_response_due_at asc)
  where first_response_at is null and status not in ('resolved','closed');

create or replace function public.rnx_set_trust_case_response_sla()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minutes integer;
begin
  if new.first_response_at is null then
    v_minutes := case new.severity
      when 'critical' then 60
      when 'high' then 240
      when 'normal' then 480
      when 'low' then 1440
      else 480
    end;
    new.first_response_sla_minutes := v_minutes;
    new.first_response_due_at := coalesce(new.created_at, now()) + make_interval(mins => v_minutes);
  end if;
  return new;
end;
$$;
revoke all on function public.rnx_set_trust_case_response_sla() from public, anon, authenticated;
drop trigger if exists rnx_set_trust_case_response_sla on public.rnx_trust_cases;
create trigger rnx_set_trust_case_response_sla
  before insert or update of severity on public.rnx_trust_cases
  for each row execute function public.rnx_set_trust_case_response_sla();

create or replace function public.rnx_record_first_trust_case_staff_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due_at timestamptz;
  v_sla_minutes integer;
  v_response_at timestamptz;
begin
  if new.sender_role = 'staff' and new.visibility = 'customer' then
    update public.rnx_trust_cases
       set first_response_at = new.created_at
     where id = new.trust_case_id
       and first_response_at is null
     returning first_response_at, first_response_due_at, first_response_sla_minutes
          into v_response_at, v_due_at, v_sla_minutes;

    if found then
      insert into public.rnx_trust_case_events (
        trust_case_id, actor_role, actor_staff_id, event_type, details
      ) values (
        new.trust_case_id,
        'staff',
        new.sender_staff_id,
        'first_customer_response_recorded',
        jsonb_build_object(
          'message_id', new.id,
          'first_response_at', v_response_at,
          'first_response_due_at', v_due_at,
          'response_sla_minutes', v_sla_minutes,
          'response_sla_met', v_due_at is not null and v_response_at <= v_due_at
        )
      );
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.rnx_record_first_trust_case_staff_response() from public, anon, authenticated;
drop trigger if exists rnx_record_first_trust_case_staff_response on public.rnx_trust_case_messages;
create trigger rnx_record_first_trust_case_staff_response
  after insert on public.rnx_trust_case_messages
  for each row execute function public.rnx_record_first_trust_case_staff_response();

comment on column public.rnx_trust_cases.first_response_sla_minutes is
  'Elapsed-time first public RNX staff response target: critical 60m, high 240m, normal 480m, low 1440m.';
comment on column public.rnx_trust_cases.first_response_due_at is
  'Target timestamp for the first customer-visible RNX staff reply, calculated from case creation and current severity.';
comment on column public.rnx_trust_cases.first_response_at is
  'Timestamp of the first customer-visible message sent by RNX staff. Internal notes and supplier/customer messages do not count.';
