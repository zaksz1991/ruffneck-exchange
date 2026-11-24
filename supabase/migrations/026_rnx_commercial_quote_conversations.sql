-- RuffNeck Exchange v3.6.0: private customer/supplier conversations on commercial quotations.
-- Apply after migrations 001-025 in the existing RuffNeck Entertainment Supabase project.

create table if not exists public.rnx_commercial_quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.rnx_commercial_quotes(id) on delete cascade,
  lead_id uuid not null references public.rnx_leads(id) on delete cascade,
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','supplier')),
  sender_id uuid not null,
  message_body text not null check (char_length(trim(message_body)) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists rnx_commercial_quote_messages_quote_created_idx
  on public.rnx_commercial_quote_messages(quote_id, created_at asc, id asc);
create index if not exists rnx_commercial_quote_messages_customer_created_idx
  on public.rnx_commercial_quote_messages(customer_id, created_at desc);
create index if not exists rnx_commercial_quote_messages_supplier_created_idx
  on public.rnx_commercial_quote_messages(supplier_application_id, created_at desc);

alter table public.rnx_commercial_quote_messages enable row level security;
revoke all on public.rnx_commercial_quote_messages from public, anon, authenticated;
grant select, insert on public.rnx_commercial_quote_messages to service_role;

comment on table public.rnx_commercial_quote_messages is
  'Private, append-only customer/supplier discussion attached to an RNX commercial quotation. Access is enforced by signed-session server routes and the send RPC.';
comment on column public.rnx_commercial_quote_messages.message_body is
  'Plain-text conversation content. Render as escaped text; do not interpret as HTML.';

-- Extend both private notification centres with a generic message alert. Message bodies
-- are not copied into notifications; participants must open the private quote thread.
alter table public.rnx_customer_notifications
  drop constraint if exists rnx_customer_notifications_notification_type_check;
alter table public.rnx_customer_notifications
  add constraint rnx_customer_notifications_notification_type_check
  check (notification_type in ('saved_listing_changed','commercial_quote_submitted','commercial_quote_message'));

alter table public.rnx_supplier_notifications
  drop constraint if exists rnx_supplier_notifications_notification_type_check;
alter table public.rnx_supplier_notifications
  add constraint rnx_supplier_notifications_notification_type_check
  check (notification_type in (
    'commercial_quote_selected',
    'commercial_quote_not_selected',
    'commercial_quote_declined',
    'commercial_quote_expired',
    'commercial_quote_message'
  ));

create or replace function public.rnx_send_commercial_quote_message(
  p_quote_id uuid,
  p_sender_role text,
  p_sender_id uuid,
  p_message_body text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.rnx_commercial_quotes%rowtype;
  v_offer public.rnx_lead_offers%rowtype;
  v_message public.rnx_commercial_quote_messages%rowtype;
  v_supplier_name text;
  v_account_status text;
  v_supplier_portal_enabled boolean;
  v_lead_id uuid;
begin
  if p_sender_role is null or p_sender_role not in ('customer','supplier') or p_sender_id is null then
    return jsonb_build_object('ok', false, 'error', 'A valid signed-in conversation participant is required.');
  end if;
  if p_message_body is null or char_length(trim(p_message_body)) < 2 or char_length(trim(p_message_body)) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'Messages must contain between 2 and 2,000 characters.');
  end if;

  -- Use the same lock order as quote submission/selection: sourcing lead, then quote, then offer.
  select lead_id into v_lead_id
  from public.rnx_commercial_quotes
  where id = p_quote_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Commercial quotation not found.');
  end if;
  perform 1 from public.rnx_leads where id = v_lead_id for update;

  select * into v_quote
  from public.rnx_commercial_quotes
  where id = p_quote_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Commercial quotation not found.');
  end if;

  if v_quote.status not in ('submitted','selected') or v_quote.valid_until <= now() then
    return jsonb_build_object('ok', false, 'error', 'This quotation conversation is closed. You can still review its earlier messages.');
  end if;

  select * into v_offer
  from public.rnx_lead_offers
  where id = v_quote.lead_offer_id
  for update;
  if not found
     or v_offer.lead_id <> v_quote.lead_id
     or v_offer.supplier_application_id <> v_quote.supplier_application_id
     or v_offer.payment_status is distinct from 'paid'
     or v_offer.payment_verified_at is null
     or v_offer.supplier_accepted_at is null
     or v_offer.customer_approved_at is null
     or v_offer.contact_released_at is null then
    return jsonb_build_object('ok', false, 'error', 'Messaging is available only after RNX has verified the introduction payment, customer approval and contact release.');
  end if;

  if not exists (select 1 from public.rnx_leads where id = v_quote.lead_id and customer_id = v_quote.customer_id) then
    return jsonb_build_object('ok', false, 'error', 'The quotation is not linked to its recorded customer request.');
  end if;

  if exists (
    select 1 from public.rnx_transaction_outcomes as outcome
    where outcome.lead_offer_id = v_offer.id
      and outcome.status in ('completed','cancelled','disputed')
  ) then
    return jsonb_build_object('ok', false, 'error', 'This conversation is closed because the transaction outcome has been finalised or referred for review.');
  end if;

  if p_sender_role = 'customer' then
    if v_quote.customer_id <> p_sender_id then
      return jsonb_build_object('ok', false, 'error', 'This quotation does not belong to your customer account.');
    end if;
    select status into v_account_status
    from public.rnx_customers
    where id = p_sender_id;
    if v_account_status is distinct from 'active' then
      return jsonb_build_object('ok', false, 'error', 'An active customer account is required to send a message.');
    end if;
  else
    if v_quote.supplier_application_id <> p_sender_id then
      return jsonb_build_object('ok', false, 'error', 'This quotation does not belong to your supplier account.');
    end if;
    select status, portal_enabled, business_name
      into v_account_status, v_supplier_portal_enabled, v_supplier_name
    from public.rnx_supplier_applications
    where id = p_sender_id;
    if v_account_status is distinct from 'approved' or v_supplier_portal_enabled is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'An active approved supplier account is required to send a message.');
    end if;
  end if;

  insert into public.rnx_commercial_quote_messages (
    quote_id, lead_id, customer_id, supplier_application_id,
    sender_role, sender_id, message_body
  ) values (
    v_quote.id, v_quote.lead_id, v_quote.customer_id, v_quote.supplier_application_id,
    p_sender_role, p_sender_id, trim(p_message_body)
  ) returning * into v_message;

  if p_sender_role = 'customer' then
    insert into public.rnx_supplier_notifications (
      supplier_application_id, notification_type, title, message, related_quote_id
    ) values (
      v_quote.supplier_application_id,
      'commercial_quote_message',
      'New customer message · ' || v_quote.quote_reference,
      'The customer sent a message in your private commercial quotation conversation. Sign in to the supplier dashboard to review and reply.',
      v_quote.id
    );
  else
    insert into public.rnx_customer_notifications (
      customer_id, notification_type, title, message, supplier_name, related_quote_id
    ) values (
      v_quote.customer_id,
      'commercial_quote_message',
      'New supplier message · ' || v_quote.quote_reference,
      'Your introduced supplier sent a message in the private commercial quotation conversation. Sign in to your customer dashboard to review and reply.',
      v_supplier_name,
      v_quote.id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message_id', v_message.id,
    'created_at', v_message.created_at,
    'quote_reference', v_quote.quote_reference
  );
end;
$$;

revoke all on function public.rnx_send_commercial_quote_message(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.rnx_send_commercial_quote_message(uuid,text,uuid,text) to service_role;
