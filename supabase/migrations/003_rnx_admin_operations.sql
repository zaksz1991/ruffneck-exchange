-- RNX v0.4.0 operations audit log.
-- Additive only. Does not modify non-RNX RuffNeck Entertainment tables.
-- Apply after migrations 001 and 002.

create table if not exists public.rnx_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null check (entity_type in ('supplier','listing','lead')),
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rnx_admin_audit_created_idx
  on public.rnx_admin_audit_log(created_at desc);
create index if not exists rnx_admin_audit_entity_idx
  on public.rnx_admin_audit_log(entity_type, entity_id, created_at desc);

alter table public.rnx_admin_audit_log enable row level security;
revoke all on public.rnx_admin_audit_log from anon, authenticated;

-- Only the server-side Supabase secret/service-role client writes this audit log.
