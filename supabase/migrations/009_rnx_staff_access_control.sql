-- RuffNeck Exchange v1.1.0: multi-user staff accounts, role access and activity history.
-- ADDITIVE ONLY. Depends on RNX migrations 001-008.
-- Creates only rnx_* objects. No existing non-RNX table is modified.

create table if not exists public.rnx_staff_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check (role in ('owner','operations_admin','finance','support','analyst')),
  status text not null default 'active' check (status in ('active','suspended')),
  password_hash text not null,
  last_login_at timestamptz,
  created_by uuid references public.rnx_staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rnx_staff_email_normalized check (email = lower(trim(email))),
  constraint rnx_staff_name_nonempty check (length(trim(full_name)) >= 2)
);

create unique index if not exists rnx_staff_users_email_uidx
  on public.rnx_staff_users (lower(email));
create index if not exists rnx_staff_users_status_role_idx
  on public.rnx_staff_users (status, role, created_at desc);

create table if not exists public.rnx_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('owner','operations_admin','finance','support','analyst')),
  token_hash text not null unique,
  created_by uuid references public.rnx_staff_users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rnx_staff_invite_email_normalized check (email = lower(trim(email))),
  constraint rnx_staff_invite_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists rnx_staff_invites_email_created_idx
  on public.rnx_staff_invitations (email, created_at desc);
create index if not exists rnx_staff_invites_expiry_idx
  on public.rnx_staff_invitations (expires_at)
  where accepted_at is null and revoked_at is null;

create table if not exists public.rnx_staff_activity (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  actor_email text not null,
  actor_role text not null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rnx_staff_activity_created_idx
  on public.rnx_staff_activity (created_at desc);
create index if not exists rnx_staff_activity_actor_idx
  on public.rnx_staff_activity (actor_staff_id, created_at desc);

alter table public.rnx_staff_users enable row level security;
alter table public.rnx_staff_invitations enable row level security;
alter table public.rnx_staff_activity enable row level security;
revoke all on public.rnx_staff_users, public.rnx_staff_invitations, public.rnx_staff_activity from public, anon, authenticated;
grant all on public.rnx_staff_users, public.rnx_staff_invitations, public.rnx_staff_activity to service_role;

-- A staff invitation is consumed atomically. The raw invitation token is never stored.
create or replace function public.rnx_accept_staff_invitation(
  p_token_hash text,
  p_password_hash text,
  p_full_name text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.rnx_staff_invitations%rowtype;
  v_staff public.rnx_staff_users%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_invitation');
  end if;
  if p_password_hash is null or length(p_password_hash) < 80 or p_full_name is null or length(trim(p_full_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'invalid_details');
  end if;

  select * into v_invite
  from public.rnx_staff_invitations
  where token_hash = p_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_invitation');
  end if;

  if exists (select 1 from public.rnx_staff_users where lower(email) = lower(v_invite.email)) then
    return jsonb_build_object('ok', false, 'error', 'account_exists');
  end if;

  insert into public.rnx_staff_users(email, full_name, role, status, password_hash, created_by)
  values (lower(trim(v_invite.email)), trim(p_full_name), v_invite.role, 'active', p_password_hash, v_invite.created_by)
  returning * into v_staff;

  update public.rnx_staff_invitations set accepted_at = now() where id = v_invite.id;
  return jsonb_build_object('ok', true, 'staff_id', v_staff.id, 'email', v_staff.email, 'role', v_staff.role);
end;
$$;

revoke all on function public.rnx_accept_staff_invitation(text, text, text) from public, anon, authenticated;
grant execute on function public.rnx_accept_staff_invitation(text, text, text) to service_role;

-- Do not allow the last active database owner to be demoted or suspended.
create or replace function public.rnx_guard_last_active_staff_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_owners integer;
begin
  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    select count(*) into v_active_owners
    from public.rnx_staff_users
    where role = 'owner' and status = 'active' and id <> old.id;
    if v_active_owners = 0 then
      raise exception 'The last active staff owner cannot be demoted or suspended.' using errcode = '23514';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rnx_staff_guard_last_owner on public.rnx_staff_users;
create trigger rnx_staff_guard_last_owner
before update on public.rnx_staff_users
for each row execute function public.rnx_guard_last_active_staff_owner();

revoke all on function public.rnx_guard_last_active_staff_owner() from public, anon, authenticated;
grant execute on function public.rnx_guard_last_active_staff_owner() to service_role;

comment on table public.rnx_staff_users is 'RNX-only staff identities. Passwords are scrypt hashes; access is server-only.';
comment on table public.rnx_staff_invitations is 'Single-use, expiring staff invitations. Only SHA-256 token hashes are stored.';
comment on table public.rnx_staff_activity is 'RNX staff audit stream. Does not store IP addresses or raw authentication secrets.';
