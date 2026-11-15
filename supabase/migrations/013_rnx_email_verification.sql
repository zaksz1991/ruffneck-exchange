-- RuffNeck Exchange v1.6.0: email ownership verification for customer and supplier accounts.
-- Additive RNX-only migration. Apply after 012_rnx_account_recovery.sql.

alter table public.rnx_customers
  add column if not exists email_verified_at timestamptz;

alter table public.rnx_supplier_applications
  add column if not exists email_verified_at timestamptz;

create table if not exists public.rnx_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('customer','supplier')),
  account_id uuid not null,
  recipient_email text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rnx_email_verification_account_idx
  on public.rnx_email_verification_tokens(account_type, account_id, created_at desc);
create index if not exists rnx_email_verification_expiry_idx
  on public.rnx_email_verification_tokens(expires_at)
  where consumed_at is null;

create table if not exists public.rnx_email_verification_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rnx_email_verification_tokens enable row level security;
alter table public.rnx_email_verification_limits enable row level security;
revoke all on table public.rnx_email_verification_tokens from public, anon, authenticated;
revoke all on table public.rnx_email_verification_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.rnx_email_verification_tokens to service_role;
grant select, insert, update, delete on table public.rnx_email_verification_limits to service_role;

create or replace function public.rnx_email_verification_allow_request(
  p_bucket_key text,
  p_max_requests integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_requests integer := least(greatest(coalesce(p_max_requests, 5), 1), 30);
  v_window_seconds integer := least(greatest(coalesce(p_window_seconds, 900), 60), 3600);
  v_count integer;
begin
  if p_bucket_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  insert into public.rnx_email_verification_limits as limits (
    bucket_key, window_started_at, request_count, updated_at
  ) values (p_bucket_key, now(), 1, now())
  on conflict (bucket_key) do update
  set window_started_at = case
        when limits.window_started_at <= now() - make_interval(secs => v_window_seconds) then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= now() - make_interval(secs => v_window_seconds) then 1
        else limits.request_count + 1
      end,
      updated_at = now()
  returning request_count into v_count;
  return v_count <= v_max_requests;
end;
$$;

create or replace function public.rnx_consume_email_verification_token(
  p_token_hash text,
  p_account_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rnx_email_verification_tokens%rowtype;
  v_updated integer;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
     or p_account_type not in ('customer','supplier') then
    return false;
  end if;

  select * into v_token
  from public.rnx_email_verification_tokens
  where token_hash = p_token_hash
    and account_type = p_account_type
  for update;

  if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
    return false;
  end if;

  if v_token.account_type = 'customer' then
    update public.rnx_customers
    set email_verified_at = coalesce(email_verified_at, now())
    where id = v_token.account_id
      and status = 'active'
      and lower(email) = lower(v_token.recipient_email);
  else
    update public.rnx_supplier_applications
    set email_verified_at = coalesce(email_verified_at, now())
    where id = v_token.account_id
      and status in ('pending','approved')
      and lower(email) = lower(v_token.recipient_email);
  end if;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  update public.rnx_email_verification_tokens
  set consumed_at = now()
  where account_type = v_token.account_type
    and account_id = v_token.account_id
    and consumed_at is null;

  return true;
end;
$$;

revoke all on function public.rnx_email_verification_allow_request(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rnx_consume_email_verification_token(text, text) from public, anon, authenticated;
grant execute on function public.rnx_email_verification_allow_request(text, integer, integer) to service_role;
grant execute on function public.rnx_consume_email_verification_token(text, text) to service_role;

-- Existing approved supplier records remain operable. A new approval transition
-- requires proof of control of the application email address.
create or replace function public.rnx_require_supplier_email_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and lower(new.email) is distinct from lower(old.email) then
    -- A changed email address must be confirmed again before portal access.
    new.email_verified_at := null;
  end if;
  if new.status = 'approved' and new.email_verified_at is null then
    if tg_op = 'INSERT' then
      raise exception 'Supplier email must be confirmed before approval.' using errcode = '23514';
    elsif old.status is distinct from 'approved' then
      raise exception 'Supplier email must be confirmed before approval.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rnx_supplier_email_confirmation_before_approval on public.rnx_supplier_applications;
create trigger rnx_supplier_email_confirmation_before_approval
before insert or update
on public.rnx_supplier_applications
for each row execute function public.rnx_require_supplier_email_confirmation();

create or replace function public.rnx_reset_customer_email_confirmation_on_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(new.email) is distinct from lower(old.email) then
    new.email_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists rnx_customer_email_confirmation_on_change on public.rnx_customers;
create trigger rnx_customer_email_confirmation_on_change
before update
on public.rnx_customers
for each row execute function public.rnx_reset_customer_email_confirmation_on_change();

revoke all on function public.rnx_require_supplier_email_confirmation() from public, anon, authenticated;
revoke all on function public.rnx_reset_customer_email_confirmation_on_change() from public, anon, authenticated;
comment on table public.rnx_email_verification_tokens is 'Private one-time email ownership confirmation tokens for RNX customer and supplier accounts; only hashes are stored.';
comment on column public.rnx_customers.email_verified_at is 'Timestamp when the customer confirmed control of the account email address.';
comment on column public.rnx_supplier_applications.email_verified_at is 'Timestamp when the supplier applicant confirmed control of the business email address; this is not business verification.';
