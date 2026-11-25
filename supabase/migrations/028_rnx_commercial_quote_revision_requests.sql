-- RuffNeck Exchange v3.9.0: customer-requested commercial quotation revisions.
-- Additive migration; requires migrations 001-027 in the RuffNeck Entertainment project.
-- A revision request closes the current submitted quote but does not accept, reject,
-- pay for or create a contract from the supplier's proposal. Revised proposals are
-- stored as new immutable quote records linked to the quote they replace.

alter table public.rnx_commercial_quotes
  drop constraint if exists rnx_commercial_quotes_status_check;
alter table public.rnx_commercial_quotes
  add constraint rnx_commercial_quotes_status_check
  check (status in ('submitted','selected','not_selected','declined','withdrawn','expired','revision_requested'));

alter table public.rnx_commercial_quotes
  add column if not exists revision_of_quote_id uuid references public.rnx_commercial_quotes(id) on delete set null,
  add column if not exists revision_request_note text,
  add column if not exists revision_requested_at timestamptz;

create unique index if not exists rnx_commercial_quotes_one_revision_per_parent_idx
  on public.rnx_commercial_quotes(revision_of_quote_id)
  where revision_of_quote_id is not null;

alter table public.rnx_commercial_quote_events
  drop constraint if exists rnx_commercial_quote_events_event_type_check;
alter table public.rnx_commercial_quote_events
  add constraint rnx_commercial_quote_events_event_type_check
  check (event_type in ('submitted','selected','not_selected','declined','withdrawn','expired','revision_requested','revision_submitted'));

-- Extend the existing supplier notification centre with revision-request notices.
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
    'commercial_quote_revision_requested'
  ));

create or replace function public.rnx_notify_supplier_commercial_quote_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification_type text;
  v_title text;
  v_message text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'selected' then
      v_notification_type := 'commercial_quote_selected';
      v_title := 'Customer marked your quotation as preferred';
      v_message := 'The customer has marked quotation ' || new.quote_reference || ' as their preferred proposal. Contact the customer through your authorised introduction to agree final details. RNX does not collect this commercial payment or guarantee fulfilment.';
    when 'not_selected' then
      v_notification_type := 'commercial_quote_not_selected';
      v_title := 'Another quotation was preferred';
      v_message := 'Quotation ' || new.quote_reference || ' was not selected because the customer marked another proposal as preferred.';
    when 'declined' then
      v_notification_type := 'commercial_quote_declined';
      v_title := 'Customer declined your quotation';
      v_message := 'The customer declined quotation ' || new.quote_reference || '. Review your opportunity inbox for its recorded status.';
    when 'expired' then
      v_notification_type := 'commercial_quote_expired';
      v_title := 'Your quotation has expired';
      v_message := 'Quotation ' || new.quote_reference || ' reached its validity deadline without a customer decision. You may submit a new proposal where the introduction remains eligible.';
    when 'revision_requested' then
      v_notification_type := 'commercial_quote_revision_requested';
      v_title := 'Customer requested a quotation revision';
      v_message := 'The customer requested changes to quotation ' || new.quote_reference || '. Sign in to your supplier dashboard to review the request and submit a revised proposal. The original quotation remains in the record.';
    else
      return new;
  end case;

  insert into public.rnx_supplier_notifications (
    supplier_application_id,
    notification_type,
    title,
    message,
    related_quote_id
  ) values (
    new.supplier_application_id,
    v_notification_type,
    v_title,
    v_message,
    new.id
  );

  return new;
end;
$$;

revoke all on function public.rnx_notify_supplier_commercial_quote_status() from public, anon, authenticated;

-- When another quotation is selected for the same sourcing request, close any
-- outstanding revision request on older proposals so suppliers do not see stale work.
create or replace function public.rnx_close_quote_revision_requests_after_selection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
begin
  if new.status <> 'selected' or old.status = 'selected' then
    return new;
  end if;

  for v_quote in
    select id, quote_reference
    from public.rnx_commercial_quotes
    where lead_id = new.lead_id
      and status = 'revision_requested'
      and id <> new.id
    order by created_at asc
    for update
  loop
    update public.rnx_commercial_quotes
    set status = 'not_selected', updated_at = now(), responded_at = now()
    where id = v_quote.id;

    insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
    values (
      v_quote.id,
      'system',
      null,
      'not_selected',
      jsonb_build_object('selected_quote_id', new.id, 'selected_quote_reference', new.quote_reference, 'reason', 'another proposal was selected')
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.rnx_close_quote_revision_requests_after_selection() from public, anon, authenticated;
drop trigger if exists rnx_close_quote_revision_requests_after_selection on public.rnx_commercial_quotes;
create trigger rnx_close_quote_revision_requests_after_selection
  after update of status on public.rnx_commercial_quotes
  for each row
  execute function public.rnx_close_quote_revision_requests_after_selection();

create or replace function public.rnx_request_commercial_quote_revision(
  p_quote_id uuid,
  p_customer_id uuid,
  p_revision_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.rnx_commercial_quotes%rowtype;
  v_lead_id uuid;
  v_note text;
begin
  v_note := trim(coalesce(p_revision_note, ''));
  if char_length(v_note) < 10 or char_length(v_note) > 800 then
    return jsonb_build_object('ok', false, 'error', 'Explain the requested changes in 10–800 characters.');
  end if;

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
  if v_quote.customer_id <> p_customer_id then
    return jsonb_build_object('ok', false, 'error', 'This quotation does not belong to your customer account.');
  end if;
  if not exists (
    select 1 from public.rnx_customers
    where id = p_customer_id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'This customer account is not active.');
  end if;
  if not exists (
    select 1
    from public.rnx_lead_offers as offer
    join public.rnx_leads as lead on lead.id = offer.lead_id
    join public.rnx_supplier_applications as supplier on supplier.id = offer.supplier_application_id
    where offer.id = v_quote.lead_offer_id
      and offer.lead_id = v_quote.lead_id
      and lead.customer_id = p_customer_id
      and offer.supplier_application_id = v_quote.supplier_application_id
      and offer.supplier_accepted_at is not null
      and offer.payment_status = 'paid'
      and offer.payment_verified_at is not null
      and offer.customer_approved_at is not null
      and offer.contact_released_at is not null
      and supplier.status = 'approved'
    ) then
    return jsonb_build_object('ok', false, 'error', 'This quotation is not attached to an active authorised supplier introduction.');
  end if;
  if v_quote.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'Only a quotation awaiting your decision can receive a revision request.');
  end if;
  if v_quote.valid_until <= now() then
    update public.rnx_commercial_quotes
    set status = 'expired', updated_at = now(), responded_at = now()
    where id = v_quote.id;
    insert into public.rnx_commercial_quote_events(quote_id, actor_role, event_type, details)
    values (v_quote.id, 'system', 'expired', '{}'::jsonb);
    return jsonb_build_object('ok', false, 'error', 'This quotation has expired. Ask the supplier for a new proposal.');
  end if;
  if exists (
    select 1 from public.rnx_transaction_outcomes as outcome
    where outcome.lead_offer_id = v_quote.lead_offer_id
      and outcome.status in ('completed','cancelled','disputed')
  ) then
    return jsonb_build_object('ok', false, 'error', 'A revision cannot be requested after the transaction outcome has been finalised or disputed.');
  end if;
  if exists (
    select 1 from public.rnx_commercial_quotes
    where revision_of_quote_id = v_quote.id
  ) then
    return jsonb_build_object('ok', false, 'error', 'A revised quotation has already been submitted for this revision request.');
  end if;

  update public.rnx_commercial_quotes
  set status = 'revision_requested',
      revision_request_note = v_note,
      revision_requested_at = now(),
      updated_at = now(),
      responded_at = now()
  where id = v_quote.id;

  insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
  values (v_quote.id, 'customer', p_customer_id, 'revision_requested', jsonb_build_object('revision_note', v_note));

  return jsonb_build_object(
    'ok', true,
    'status', 'revision_requested',
    'quote_reference', v_quote.quote_reference,
    'supplier_application_id', v_quote.supplier_application_id,
    'lead_id', v_quote.lead_id
  );
end;
$$;

create or replace function public.rnx_submit_commercial_quote_revision(
  p_previous_quote_id uuid,
  p_supplier_id uuid,
  p_title text,
  p_scope_description text,
  p_total_amount numeric,
  p_currency text,
  p_delivery_terms text,
  p_estimated_fulfilment text,
  p_valid_days integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent public.rnx_commercial_quotes%rowtype;
  v_lead_id uuid;
  v_result jsonb;
  v_new_quote_id uuid;
begin
  select lead_id into v_lead_id
  from public.rnx_commercial_quotes
  where id = p_previous_quote_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'The quotation revision request was not found.');
  end if;

  perform 1 from public.rnx_leads where id = v_lead_id for update;
  select * into v_parent
  from public.rnx_commercial_quotes
  where id = p_previous_quote_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'The quotation revision request was not found.');
  end if;
  if v_parent.supplier_application_id <> p_supplier_id then
    return jsonb_build_object('ok', false, 'error', 'This revision request does not belong to your supplier account.');
  end if;
  if v_parent.status <> 'revision_requested' then
    return jsonb_build_object('ok', false, 'error', 'This quotation is not awaiting a supplier revision.');
  end if;
  if exists (
    select 1 from public.rnx_commercial_quotes
    where revision_of_quote_id = v_parent.id
  ) then
    return jsonb_build_object('ok', false, 'error', 'A revised quotation has already been submitted for this request.');
  end if;

  v_result := public.rnx_submit_commercial_quote(
    v_parent.lead_offer_id,
    p_supplier_id,
    p_title,
    p_scope_description,
    p_total_amount,
    p_currency,
    p_delivery_terms,
    p_estimated_fulfilment,
    p_valid_days
  );
  if coalesce((v_result->>'ok')::boolean, false) is not true then
    return v_result;
  end if;

  v_new_quote_id := nullif(v_result->>'quote_id', '')::uuid;
  if v_new_quote_id is null then
    raise exception 'The new quotation record was not returned by the submission function.';
  end if;

  update public.rnx_commercial_quotes
  set revision_of_quote_id = v_parent.id
  where id = v_new_quote_id
    and supplier_application_id = p_supplier_id;

  insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
  values (
    v_new_quote_id,
    'supplier',
    p_supplier_id,
    'revision_submitted',
    jsonb_build_object('revision_of_quote_id', v_parent.id, 'previous_quote_reference', v_parent.quote_reference)
  );

  return v_result || jsonb_build_object('revision_of_quote_id', v_parent.id);
end;
$$;

revoke all on function public.rnx_request_commercial_quote_revision(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.rnx_submit_commercial_quote_revision(uuid,uuid,text,text,numeric,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.rnx_request_commercial_quote_revision(uuid,uuid,text) to service_role;
grant execute on function public.rnx_submit_commercial_quote_revision(uuid,uuid,text,text,numeric,text,text,text,integer) to service_role;

comment on column public.rnx_commercial_quotes.revision_of_quote_id is
  'Links a supplier-submitted revised quotation to the earlier immutable quotation that the customer asked to revise.';
comment on column public.rnx_commercial_quotes.revision_request_note is
  'Customer-authored request for changes to this quotation; visible only to the authorised customer, owning supplier and RNX Operations.';
