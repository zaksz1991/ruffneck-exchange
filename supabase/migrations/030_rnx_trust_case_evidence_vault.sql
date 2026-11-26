-- RuffNeck Exchange v3.12.0: private evidence vault for customer protection cases.
-- ADDITIVE ONLY. Requires the cumulative RNX schema through migration 029.
-- Browser clients receive no direct access to evidence metadata or Storage objects.

create table if not exists public.rnx_trust_case_attachments (
  id uuid primary key default gen_random_uuid(),
  trust_case_id uuid not null references public.rnx_trust_cases(id) on delete cascade,
  uploader_role text not null check (uploader_role in ('customer','supplier','staff')),
  uploader_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  uploader_supplier_id uuid references public.rnx_supplier_applications(id) on delete set null,
  visibility text not null default 'customer' check (visibility in ('customer','internal')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 120),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size_bytes integer not null check (file_size_bytes between 1 and 4194304),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint rnx_trust_case_attachment_uploader_consistency check (
    (uploader_role = 'customer' and uploader_staff_id is null and uploader_supplier_id is null and visibility = 'customer')
    or (uploader_role = 'supplier' and uploader_staff_id is null and uploader_supplier_id is not null and visibility = 'customer')
    or (uploader_role = 'staff' and uploader_supplier_id is null)
  )
);

create index if not exists rnx_trust_case_attachments_case_created_idx
  on public.rnx_trust_case_attachments(trust_case_id, created_at asc);
create index if not exists rnx_trust_case_attachments_visibility_idx
  on public.rnx_trust_case_attachments(trust_case_id, visibility, created_at asc);

alter table public.rnx_trust_case_attachments enable row level security;
revoke all on public.rnx_trust_case_attachments from public, anon, authenticated;
grant all on public.rnx_trust_case_attachments to service_role;

-- Storage objects are uploaded first by a server route. This RPC atomically records
-- the file metadata, appends the case event and touches the linked lead/case.
create or replace function public.rnx_record_trust_case_attachment(
  p_case_id uuid,
  p_uploader_role text,
  p_uploader_staff_id uuid,
  p_uploader_supplier_id uuid,
  p_actor_email text,
  p_visibility text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attachment_id uuid;
  v_case public.rnx_trust_cases%rowtype;
  v_count integer;
begin
  if p_uploader_role not in ('customer','supplier','staff') then
    raise exception 'Invalid trust-case evidence uploader role.';
  end if;
  if p_visibility not in ('customer','internal') then
    raise exception 'Invalid trust-case evidence visibility.';
  end if;
  if p_uploader_role in ('customer','supplier') and p_visibility <> 'customer' then
    raise exception 'Customer and supplier evidence must be customer-visible.';
  end if;
  if p_uploader_role = 'customer' and (p_uploader_staff_id is not null or p_uploader_supplier_id is not null) then
    raise exception 'Customer evidence cannot claim staff or supplier authorship.';
  end if;
  if p_uploader_role = 'supplier' and (p_uploader_staff_id is not null or p_uploader_supplier_id is null) then
    raise exception 'Supplier evidence requires supplier authorship.';
  end if;
  if p_uploader_role = 'staff' and p_uploader_supplier_id is not null then
    raise exception 'Staff evidence cannot claim supplier authorship.';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 4194304 then
    raise exception 'Trust-case evidence files must be no larger than 4 MB.';
  end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Unsupported trust-case evidence file type.';
  end if;
  if coalesce(p_file_name,'') = '' or char_length(p_file_name) > 120 then
    raise exception 'Invalid trust-case evidence file name.';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Trust-case evidence notes must be 500 characters or fewer.';
  end if;

  select * into v_case from public.rnx_trust_cases where id = p_case_id for update;
  if not found then raise exception 'Trust case not found.'; end if;

  select count(*) into v_count
    from public.rnx_trust_case_attachments
    where trust_case_id = p_case_id;
  if v_count >= 20 then raise exception 'TRUST_CASE_ATTACHMENT_LIMIT'; end if;

  insert into public.rnx_trust_case_attachments (
    trust_case_id, uploader_role, uploader_staff_id, uploader_supplier_id,
    visibility, storage_path, file_name, mime_type, file_size_bytes, note
  ) values (
    p_case_id, p_uploader_role, p_uploader_staff_id, p_uploader_supplier_id,
    p_visibility, p_storage_path, p_file_name, p_mime_type, p_file_size_bytes, nullif(trim(p_note),'')
  ) returning id into v_attachment_id;

  insert into public.rnx_trust_case_events (
    trust_case_id, actor_role, actor_staff_id, actor_supplier_id, actor_email,
    event_type, details
  ) values (
    p_case_id,
    p_uploader_role,
    case when p_uploader_role = 'staff' then p_uploader_staff_id else null end,
    case when p_uploader_role = 'supplier' then p_uploader_supplier_id else null end,
    nullif(lower(trim(p_actor_email)),''),
    'evidence_uploaded',
    jsonb_build_object(
      'attachment_id', v_attachment_id,
      'file_name', p_file_name,
      'mime_type', p_mime_type,
      'file_size_bytes', p_file_size_bytes,
      'visibility', p_visibility
    )
  );

  update public.rnx_trust_cases set updated_at = now() where id = p_case_id;
  update public.rnx_leads set last_activity_at = now() where id = v_case.lead_id;
  return v_attachment_id;
end;
$$;

revoke all on function public.rnx_record_trust_case_attachment(uuid,text,uuid,uuid,text,text,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.rnx_record_trust_case_attachment(uuid,text,uuid,uuid,text,text,text,text,text,integer,text) to service_role;

comment on table public.rnx_trust_case_attachments is
  'Private supporting files for RNX customer protection cases. All metadata access is server-only; downloads use short-lived signed URLs after case-specific authorisation.';
comment on column public.rnx_trust_case_attachments.visibility is
  'customer files are shared with the customer, assigned supplier and authorised RNX staff; internal files are staff-only.';
comment on function public.rnx_record_trust_case_attachment(uuid,text,uuid,uuid,text,text,text,text,text,integer,text) is
  'Service-role-only transactional metadata/event writer for evidence already uploaded to the private RNX trust-case Storage bucket.';
