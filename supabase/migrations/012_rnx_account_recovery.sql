-- RuffNeck Exchange v1.5.0: one-time customer and supplier password recovery.
-- Additive RNX-only migration. Depends on migrations 001-011.

create table if not exists public.rnx_account_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('customer', 'supplier')),
  account_id uuid not null,
  recipient_email text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rnx_account_recovery_account_idx
  on public.rnx_account_recovery_tokens(account_type, account_id, created_at desc);
create index if not exists rnx_account_recovery_expiry_idx
  on public.rnx_account_recovery_tokens(expires_at)
  where consumed_at is null;

alter table public.rnx_account_recovery_tokens enable row level security;
revoke all on table public.rnx_account_recovery_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.rnx_account_recovery_tokens to service_role;

create table if not exists public.rnx_account_recovery_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rnx_account_recovery_limits enable row level security;
revoke all on table public.rnx_account_recovery_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.rnx_account_recovery_limits to service_role;

create or replace function public.rnx_account_recovery_allow_request(
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
  v_max_requests integer := least(greatest(coalesce(p_max_requests, 5), 1), 10);
  v_window_seconds integer := least(greatest(coalesce(p_window_seconds, 900), 60), 3600);
  v_count integer;
begin
  if p_bucket_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into public.rnx_account_recovery_limits as limits (
    bucket_key, window_started_at, request_count, updated_at
  ) values (
    p_bucket_key, now(), 1, now()
  )
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

create or replace function public.rnx_consume_account_recovery_token(
  p_token_hash text,
  p_account_type text,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rnx_account_recovery_tokens%rowtype;
  v_updated integer;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
     or p_account_type not in ('customer', 'supplier')
     or p_password_hash !~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$' then
    return false;
  end if;

  select * into v_token
  from public.rnx_account_recovery_tokens
  where token_hash = p_token_hash
    and account_type = p_account_type
  for update;

  if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
    return false;
  end if;

  if v_token.account_type = 'customer' then
    update public.rnx_customers
    set password_hash = p_password_hash
    where id = v_token.account_id
      and status = 'active'
      and lower(email) = lower(v_token.recipient_email);
  else
    update public.rnx_supplier_applications
    set portal_password_hash = p_password_hash
    where id = v_token.account_id
      and status = 'approved'
      and portal_enabled = true
      and lower(email) = lower(v_token.recipient_email);
  end if;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  -- Consuming this token also invalidates every other outstanding link for the account.
  update public.rnx_account_recovery_tokens
  set consumed_at = now()
  where account_type = v_token.account_type
    and account_id = v_token.account_id
    and consumed_at is null;

  return true;
end;
$$;

revoke all on function public.rnx_account_recovery_allow_request(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rnx_consume_account_recovery_token(text, text, text) from public, anon, authenticated;
grant execute on function public.rnx_account_recovery_allow_request(text, integer, integer) to service_role;
grant execute on function public.rnx_consume_account_recovery_token(text, text, text) to service_role;
