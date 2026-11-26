-- RuffNeck Exchange v3.11.0: supplier response centre for customer protection cases.
-- Additive migration. Requires the cumulative RNX schema through migration 028.
-- Suppliers can respond only after RNX explicitly moves a case to awaiting_supplier.
-- Internal staff notes and customer contact details are never exposed to supplier APIs.

alter table public.rnx_trust_cases
  add column if not exists supplier_response_requested_at timestamptz;

create index if not exists rnx_trust_cases_supplier_response_idx
  on public.rnx_trust_cases(supplier_application_id, status, updated_at desc)
  where supplier_response_requested_at is not null and supplier_application_id is not null;

-- Preserve existing customer/staff messages while adding a separately attributed supplier sender.
alter table public.rnx_trust_case_messages
  add column if not exists sender_supplier_id uuid references public.rnx_supplier_applications(id);

alter table public.rnx_trust_case_messages
  drop constraint if exists rnx_trust_case_messages_sender_role_check;
alter table public.rnx_trust_case_messages
  add constraint rnx_trust_case_messages_sender_role_check
  check (sender_role in ('customer','staff','supplier'));

alter table public.rnx_trust_case_messages
  drop constraint if exists rnx_trust_case_message_sender_consistency;
alter table public.rnx_trust_case_messages
  add constraint rnx_trust_case_message_sender_consistency
  check (
    (sender_role = 'customer' and sender_staff_id is null and sender_supplier_id is null and visibility = 'customer')
    or (sender_role = 'staff' and sender_supplier_id is null)
    or (sender_role = 'supplier' and sender_staff_id is null and sender_supplier_id is not null and visibility = 'customer')
  );

alter table public.rnx_trust_case_events
  add column if not exists actor_supplier_id uuid references public.rnx_supplier_applications(id) on delete set null;
alter table public.rnx_trust_case_events
  drop constraint if exists rnx_trust_case_events_actor_role_check;
alter table public.rnx_trust_case_events
  add constraint rnx_trust_case_events_actor_role_check
  check (actor_role in ('customer','staff','system','supplier'));

-- A supplier notification points to the case but contains no customer identity or allegation details.
alter table public.rnx_supplier_notifications
  add column if not exists related_trust_case_id uuid references public.rnx_trust_cases(id) on delete set null;
alter table public.rnx_supplier_notifications
  drop constraint if exists rnx_supplier_notifications_notification_type_check;
alter table public.rnx_supplier_notifications
  add constraint rnx_supplier_notifications_notification_type_check
  check (notification_type in (
    'commercial_quote_selected',
    'commercial_quote_not_selected',
    'commercial_quote_declined',
    'commercial_quote_expired',
    'commercial_quote_message',
    'commercial_quote_revision_requested',
    'trust_case_response_requested'
  ));
create index if not exists rnx_supplier_notifications_trust_case_idx
  on public.rnx_supplier_notifications(supplier_application_id, created_at desc)
  where related_trust_case_id is not null;

-- Stamp the latest time RNX requests a supplier response. Re-requesting a response
-- after a staff review updates the timestamp again.
create or replace function public.rnx_stamp_supplier_trust_response_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'awaiting_supplier' and old.status is distinct from new.status then
    new.supplier_response_requested_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.rnx_stamp_supplier_trust_response_request() from public, anon, authenticated;
drop trigger if exists rnx_stamp_supplier_trust_response_request on public.rnx_trust_cases;
create trigger rnx_stamp_supplier_trust_response_request
  before update of status on public.rnx_trust_cases
  for each row execute function public.rnx_stamp_supplier_trust_response_request();

-- Notify the supplier only when an authorised RNX staff member explicitly requests a response.
create or replace function public.rnx_notify_supplier_trust_case_response_requested()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'awaiting_supplier'
     and old.status is distinct from new.status
     and new.supplier_application_id is not null then
    insert into public.rnx_supplier_notifications (
      supplier_application_id,
      notification_type,
      title,
      message,
      related_trust_case_id
    ) values (
      new.supplier_application_id,
      'trust_case_response_requested',
      'RNX requested a response to a customer case',
      'Case ' || new.case_reference || ' is awaiting your response. Review the report in your private supplier dashboard.',
      new.id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.rnx_notify_supplier_trust_case_response_requested() from public, anon, authenticated;
drop trigger if exists rnx_supplier_trust_case_response_requested on public.rnx_trust_cases;
create trigger rnx_supplier_trust_case_response_requested
  after update of status on public.rnx_trust_cases
  for each row execute function public.rnx_notify_supplier_trust_case_response_requested();

-- Existing cases already awaiting supplier response become visible in the supplier inbox.
update public.rnx_trust_cases
set supplier_response_requested_at = coalesce(supplier_response_requested_at, updated_at, now())
where status = 'awaiting_supplier'
  and supplier_application_id is not null
  and lead_offer_id is not null
  and exists (
    select 1 from public.rnx_lead_offers lo
    where lo.id = rnx_trust_cases.lead_offer_id
      and lo.lead_id = rnx_trust_cases.lead_id
      and lo.supplier_application_id = rnx_trust_cases.supplier_application_id
      and lo.supplier_accepted_at is not null
      and lo.payment_status = 'paid'
      and lo.payment_verified_at is not null
      and lo.customer_approved_at is not null
      and lo.contact_released_at is not null
  );

insert into public.rnx_supplier_notifications (
  supplier_application_id, notification_type, title, message, related_trust_case_id
)
select
  c.supplier_application_id,
  'trust_case_response_requested',
  'RNX requested a response to a customer case',
  'Case ' || c.case_reference || ' is awaiting your response. Review the report in your private supplier dashboard.',
  c.id
from public.rnx_trust_cases c
where c.status = 'awaiting_supplier'
  and c.supplier_application_id is not null
  and c.lead_offer_id is not null
  and c.supplier_response_requested_at is not null
  and exists (
    select 1 from public.rnx_lead_offers lo
    where lo.id = c.lead_offer_id
      and lo.lead_id = c.lead_id
      and lo.supplier_application_id = c.supplier_application_id
      and lo.supplier_accepted_at is not null
      and lo.payment_status = 'paid'
      and lo.payment_verified_at is not null
      and lo.customer_approved_at is not null
      and lo.contact_released_at is not null
  )
  and not exists (
    select 1 from public.rnx_supplier_notifications n
    where n.supplier_application_id = c.supplier_application_id
      and n.related_trust_case_id = c.id
      and n.notification_type = 'trust_case_response_requested'
  );

-- Service-role-only response function. It verifies supplier ownership, the actual
-- contact-released introduction, and that RNX currently expects a supplier response.
create or replace function public.rnx_supplier_submit_trust_case_response(
  p_case_id uuid,
  p_supplier_application_id uuid,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.rnx_trust_cases%rowtype;
  v_supplier public.rnx_supplier_applications%rowtype;
  v_offer public.rnx_lead_offers%rowtype;
  v_message public.rnx_trust_case_messages%rowtype;
begin
  if p_body is null or char_length(trim(p_body)) < 10 or char_length(trim(p_body)) > 3000 then
    return jsonb_build_object('ok', false, 'error', 'Enter a supplier response of 10–3,000 characters.');
  end if;

  select * into v_case
  from public.rnx_trust_cases
  where id = p_case_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Customer case not found.');
  end if;
  if v_case.supplier_application_id is null or v_case.supplier_application_id <> p_supplier_application_id then
    return jsonb_build_object('ok', false, 'error', 'This case is not assigned to your supplier account.');
  end if;
  if v_case.supplier_response_requested_at is null or v_case.status <> 'awaiting_supplier' then
    return jsonb_build_object('ok', false, 'error', 'RNX is not currently requesting a supplier response to this case.');
  end if;

  select * into v_supplier
  from public.rnx_supplier_applications
  where id = p_supplier_application_id
    and status = 'approved'
    and portal_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Your supplier portal is not active.');
  end if;

  if v_case.lead_offer_id is null then
    return jsonb_build_object('ok', false, 'error', 'This case is not attached to a released supplier introduction.');
  end if;
  select * into v_offer
  from public.rnx_lead_offers
  where id = v_case.lead_offer_id
    and lead_id = v_case.lead_id
    and supplier_application_id = p_supplier_application_id
    and supplier_accepted_at is not null
    and payment_status = 'paid'
    and payment_verified_at is not null
    and customer_approved_at is not null
    and contact_released_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'The supplier introduction is not currently authorised for this response. Contact RNX Operations.');
  end if;

  insert into public.rnx_trust_case_messages (
    trust_case_id, sender_role, sender_supplier_id, sender_name, visibility, body
  ) values (
    v_case.id, 'supplier', p_supplier_application_id, v_supplier.business_name, 'customer', trim(p_body)
  ) returning * into v_message;

  update public.rnx_trust_cases
  set status = 'under_review', updated_at = now()
  where id = v_case.id and status = 'awaiting_supplier';

  insert into public.rnx_trust_case_events (
    trust_case_id, actor_role, actor_supplier_id, event_type, from_status, to_status, details
  ) values (
    v_case.id, 'supplier', p_supplier_application_id, 'supplier_response_submitted',
    'awaiting_supplier', 'under_review', jsonb_build_object('message_id', v_message.id)
  );

  update public.rnx_leads
  set last_activity_at = now()
  where id = v_case.lead_id;

  return jsonb_build_object(
    'ok', true,
    'case_id', v_case.id,
    'case_reference', v_case.case_reference,
    'status', 'under_review',
    'message_id', v_message.id
  );
end;
$$;

revoke all on function public.rnx_supplier_submit_trust_case_response(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.rnx_supplier_submit_trust_case_response(uuid,uuid,text) to service_role;

comment on column public.rnx_trust_cases.supplier_response_requested_at is
  'Latest time RNX explicitly requested a response from the supplier attached to this authorised introduction.';
comment on column public.rnx_trust_case_messages.sender_supplier_id is
  'Supplier account that authored a customer-visible response in an RNX trust case.';
comment on column public.rnx_supplier_notifications.related_trust_case_id is
  'Optional private pointer from a supplier notification to an RNX customer protection case.';
