-- RuffNeck Exchange v0.7.0: customer accounts, private request tracking,
-- customer/operations message threads and email notification outbox.
-- ADDITIVE ONLY. Depends on RNX migrations 001-005. No non-RNX tables are altered.

create table if not exists public.rnx_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null,
  phone text not null check (char_length(phone) between 7 and 30),
  password_hash text not null,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists rnx_customers_email_lower_uidx on public.rnx_customers(lower(email));

alter table public.rnx_leads
  add column if not exists customer_id uuid references public.rnx_customers(id) on delete set null,
  add column if not exists tracking_token_hash text,
  add column if not exists last_activity_at timestamptz;
create unique index if not exists rnx_leads_tracking_token_hash_uidx
  on public.rnx_leads(tracking_token_hash) where tracking_token_hash is not null;
create index if not exists rnx_leads_customer_created_idx on public.rnx_leads(customer_id,created_at desc);

create table if not exists public.rnx_lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.rnx_leads(id) on delete cascade,
  customer_id uuid references public.rnx_customers(id) on delete set null,
  sender_role text not null check (sender_role in ('customer','operations')),
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  body text not null check (char_length(body) between 2 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists rnx_lead_messages_lead_created_idx on public.rnx_lead_messages(lead_id,created_at);

create table if not exists public.rnx_notifications (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email' check (channel in ('email')),
  recipient_email text not null,
  subject text not null check (char_length(subject) between 1 and 200),
  body_text text not null,
  related_lead_id uuid references public.rnx_leads(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_reference text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rnx_notifications_status_created_idx on public.rnx_notifications(status,created_at);

create table if not exists public.rnx_customer_auth_attempts (
  attempt_key text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.rnx_customers enable row level security;
alter table public.rnx_lead_messages enable row level security;
alter table public.rnx_notifications enable row level security;
alter table public.rnx_customer_auth_attempts enable row level security;
revoke all on public.rnx_customers,public.rnx_lead_messages,public.rnx_notifications,public.rnx_customer_auth_attempts from anon,authenticated;
revoke all on public.rnx_leads from anon,authenticated;

create or replace function public.rnx_customer_auth_is_locked(p_attempt_key text)
returns boolean language sql security definer set search_path=public as $$
  select coalesce((select locked_until > now() from public.rnx_customer_auth_attempts where attempt_key=p_attempt_key),false);
$$;

create or replace function public.rnx_customer_auth_register_failure(
  p_attempt_key text,p_max_attempts integer default 6,p_window_minutes integer default 15,p_lock_minutes integer default 30
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.rnx_customer_auth_attempts%rowtype;
begin
  insert into public.rnx_customer_auth_attempts as current_attempt(attempt_key,failures,window_started_at,updated_at)
  values(p_attempt_key,1,now(),now())
  on conflict(attempt_key) do update set
    failures=case when current_attempt.window_started_at < now()-make_interval(mins=>p_window_minutes) then 1 else current_attempt.failures+1 end,
    window_started_at=case when current_attempt.window_started_at < now()-make_interval(mins=>p_window_minutes) then now() else current_attempt.window_started_at end,
    locked_until=case when current_attempt.locked_until>now() then current_attempt.locked_until
      when (case when current_attempt.window_started_at < now()-make_interval(mins=>p_window_minutes) then 1 else current_attempt.failures+1 end)>=p_max_attempts
      then now()+make_interval(mins=>p_lock_minutes) else null end,
    updated_at=now()
  returning * into v_row;
  return jsonb_build_object('failures',v_row.failures,'locked_until',v_row.locked_until);
end;
$$;

create or replace function public.rnx_customer_auth_clear(p_attempt_key text)
returns void language sql security definer set search_path=public as $$
  delete from public.rnx_customer_auth_attempts where attempt_key=p_attempt_key;
$$;

revoke all on function public.rnx_customer_auth_is_locked(text) from public,anon,authenticated;
revoke all on function public.rnx_customer_auth_register_failure(text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.rnx_customer_auth_clear(text) from public,anon,authenticated;
grant execute on function public.rnx_customer_auth_is_locked(text) to service_role;
grant execute on function public.rnx_customer_auth_register_failure(text,integer,integer,integer) to service_role;
grant execute on function public.rnx_customer_auth_clear(text) to service_role;
