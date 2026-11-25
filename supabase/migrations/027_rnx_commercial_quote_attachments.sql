-- RuffNeck Exchange v3.7.0: private PDF/image attachments on quotation conversations.
-- Apply after migrations 001-026 in the existing RuffNeck Entertainment Supabase project.

create unique index if not exists rnx_commercial_quote_messages_id_quote_unique_idx
  on public.rnx_commercial_quote_messages(id, quote_id);

create table if not exists public.rnx_commercial_quote_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique,
  quote_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 120),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 4194304),
  created_at timestamptz not null default now(),
  constraint rnx_quote_attachment_message_quote_fk
    foreign key (message_id, quote_id)
    references public.rnx_commercial_quote_messages(id, quote_id) on delete cascade,
  constraint rnx_quote_attachment_storage_path_shape check (
    storage_path ~ '^[0-9a-f-]{36}/(customer|supplier)/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$'
  ),
  constraint rnx_quote_attachment_file_name_shape check (
    file_name ~ '^[A-Za-z0-9._-]{1,104}[.](pdf|jpg|png|webp)$'
  )
);

create index if not exists rnx_quote_message_attachments_quote_created_idx
  on public.rnx_commercial_quote_message_attachments(quote_id, created_at desc);

alter table public.rnx_commercial_quote_message_attachments enable row level security;
revoke all on public.rnx_commercial_quote_message_attachments from public, anon, authenticated;
grant select, insert on public.rnx_commercial_quote_message_attachments to service_role;

comment on table public.rnx_commercial_quote_message_attachments is
  'Private metadata for files attached to customer/supplier commercial quotation messages. Raw storage paths are not exposed in message-list responses; signed downloads are issued after participant checks.';

create or replace function public.rnx_send_commercial_quote_attachment(
  p_quote_id uuid,
  p_sender_role text,
  p_sender_id uuid,
  p_message_body text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_message_id uuid;
  v_attachment_count bigint;
  v_attachment public.rnx_commercial_quote_message_attachments%rowtype;
begin
  if p_quote_id is null or p_sender_role is null or p_sender_role not in ('customer','supplier') or p_sender_id is null then
    return jsonb_build_object('ok', false, 'error', 'A valid signed-in conversation participant is required.');
  end if;
  if p_storage_path is null
     or p_storage_path !~ ('^' || p_quote_id::text || '/' || p_sender_role || '/' || p_sender_id::text || '/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$') then
    return jsonb_build_object('ok', false, 'error', 'The attachment storage reference is invalid.');
  end if;
  if p_file_name is null
     or p_file_name !~ '^[A-Za-z0-9._-]{1,104}[.](pdf|jpg|png|webp)$'
     or p_mime_type is null
     or p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp')
     or p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 4194304 then
    return jsonb_build_object('ok', false, 'error', 'The attachment must be a PDF, JPEG, PNG or WebP file no larger than 4 MB.');
  end if;

  -- Reuse the same participant, contact-release, quote-state, expiry and outcome checks
  -- as plain-text messages. A failure aborts this entire transaction, including metadata.
  v_result := public.rnx_send_commercial_quote_message(
    p_quote_id, p_sender_role, p_sender_id, p_message_body
  );
  if coalesce((v_result->>'ok')::boolean, false) is not true then
    return v_result;
  end if;

  -- The existing message RPC holds the quotation lock until this transaction commits.
  -- The cap is checked under that lock so parallel uploads cannot exceed the limit.
  select count(*) into v_attachment_count
  from public.rnx_commercial_quote_message_attachments
  where quote_id = p_quote_id;
  if v_attachment_count >= 20 then
    raise exception using errcode = 'P0001', message = 'QUOTATION_ATTACHMENT_LIMIT';
  end if;

  v_message_id := (v_result->>'message_id')::uuid;
  insert into public.rnx_commercial_quote_message_attachments (
    message_id, quote_id, storage_path, file_name, mime_type, file_size_bytes
  ) values (
    v_message_id, p_quote_id, p_storage_path, p_file_name, p_mime_type, p_file_size_bytes
  ) returning * into v_attachment;

  return v_result || jsonb_build_object(
    'attachment_id', v_attachment.id,
    'file_name', v_attachment.file_name,
    'mime_type', v_attachment.mime_type,
    'file_size_bytes', v_attachment.file_size_bytes
  );
end;
$$;

revoke all on function public.rnx_send_commercial_quote_attachment(uuid,text,uuid,text,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.rnx_send_commercial_quote_attachment(uuid,text,uuid,text,text,text,text,bigint) to service_role;
