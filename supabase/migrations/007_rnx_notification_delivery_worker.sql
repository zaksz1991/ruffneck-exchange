-- RuffNeck Exchange v0.9.0: safe notification claiming, retry scheduling and worker leases.
-- ADDITIVE ONLY. Depends on migrations 001-006. Alters only public.rnx_notifications.

alter table public.rnx_notifications
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists lock_expires_at timestamptz,
  add column if not exists failure_code text;

alter table public.rnx_notifications
  drop constraint if exists rnx_notifications_status_check;

alter table public.rnx_notifications
  add constraint rnx_notifications_status_check
  check (status in ('pending','processing','sent','failed','cancelled'));

create index if not exists rnx_notifications_due_idx
  on public.rnx_notifications(status, next_attempt_at, created_at)
  where status in ('pending','failed');

create index if not exists rnx_notifications_expired_lease_idx
  on public.rnx_notifications(lock_expires_at)
  where status='processing';

create or replace function public.rnx_claim_notifications(
  p_notification_id uuid default null,
  p_batch_size integer default 10,
  p_max_attempts integer default 5
)
returns table (
  notification_id uuid,
  recipient_email text,
  subject text,
  body_text text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_attempts integer := least(greatest(coalesce(p_max_attempts, 5), 1), 10);
  v_batch_size integer := least(greatest(coalesce(p_batch_size, 10), 1), 20);
begin
  -- Expired rows that exhausted their retry budget are made terminal failures.
  update public.rnx_notifications as n
  set status='failed',
      last_error=coalesce(n.last_error, 'Notification processing lease expired after the final attempt.'),
      failure_code=coalesce(n.failure_code, 'lease_expired_exhausted'),
      next_attempt_at=null,
      locked_at=null,
      lock_expires_at=null,
      updated_at=now()
  where n.status='processing'
    and n.lock_expires_at is not null
    and n.lock_expires_at <= now()
    and n.attempts >= v_max_attempts;

  return query
  with eligible as (
    select n.id
    from public.rnx_notifications as n
    where (p_notification_id is null or n.id=p_notification_id)
      and n.attempts < v_max_attempts
      and (
        (n.status='pending' and (n.next_attempt_at is null or n.next_attempt_at <= now()))
        or (n.status='failed' and n.next_attempt_at is not null and n.next_attempt_at <= now())
        or (n.status='processing' and n.lock_expires_at is not null and n.lock_expires_at <= now())
      )
    order by n.created_at asc
    for update skip locked
    limit case when p_notification_id is null then v_batch_size else 1 end
  ), claimed as (
    update public.rnx_notifications as n
    set status='processing',
        attempts=n.attempts+1,
        locked_at=now(),
        lock_expires_at=now()+interval '2 minutes',
        next_attempt_at=null,
        updated_at=now()
    from eligible
    where n.id=eligible.id
    returning n.id,n.recipient_email,n.subject,n.body_text,n.attempts
  )
  select c.id,c.recipient_email,c.subject,c.body_text,c.attempts
  from claimed as c;
end;
$$;

revoke all on function public.rnx_claim_notifications(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.rnx_claim_notifications(uuid,integer,integer) to service_role;
