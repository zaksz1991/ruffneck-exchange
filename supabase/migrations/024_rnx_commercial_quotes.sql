-- RuffNeck Exchange v3.2.0: supplier commercial quotations after authorised introductions.
-- Additive RNX-only migration. Requires migrations 001-023 in the RuffNeck Entertainment project.
-- A commercial quote is a supplier proposal to a customer after RNX has completed its
-- existing payment, customer-approval and contact-release gates. Selecting a quote is
-- only a customer preference record; it is not a payment, contract or fulfilment guarantee.

create table if not exists public.rnx_commercial_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_reference text not null unique,
  lead_offer_id uuid not null references public.rnx_lead_offers(id) on delete cascade,
  lead_id uuid not null references public.rnx_leads(id) on delete cascade,
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  scope_description text not null check (char_length(trim(scope_description)) between 20 and 3000),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  delivery_terms text not null check (char_length(trim(delivery_terms)) between 2 and 1200),
  estimated_fulfilment text check (estimated_fulfilment is null or char_length(trim(estimated_fulfilment)) between 2 and 160),
  valid_until timestamptz not null,
  status text not null default 'submitted'
    check (status in ('submitted','selected','not_selected','declined','withdrawn','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists rnx_commercial_quotes_customer_created_idx
  on public.rnx_commercial_quotes(customer_id, created_at desc);
create index if not exists rnx_commercial_quotes_supplier_created_idx
  on public.rnx_commercial_quotes(supplier_application_id, created_at desc);
create index if not exists rnx_commercial_quotes_lead_offer_created_idx
  on public.rnx_commercial_quotes(lead_offer_id, created_at desc);
create index if not exists rnx_commercial_quotes_status_expiry_idx
  on public.rnx_commercial_quotes(status, valid_until);
drop index if exists public.rnx_commercial_quotes_one_open_per_introduction_idx;
create unique index if not exists rnx_commercial_quotes_one_active_per_introduction_idx
  on public.rnx_commercial_quotes(lead_offer_id)
  where status in ('submitted','selected');
create unique index if not exists rnx_commercial_quotes_one_selected_per_request_idx
  on public.rnx_commercial_quotes(lead_id)
  where status = 'selected';

alter table public.rnx_commercial_quotes enable row level security;
revoke all on public.rnx_commercial_quotes from public, anon, authenticated;

create table if not exists public.rnx_commercial_quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.rnx_commercial_quotes(id) on delete cascade,
  actor_role text not null check (actor_role in ('supplier','customer','system')),
  actor_id uuid,
  event_type text not null check (event_type in ('submitted','selected','not_selected','declined','withdrawn','expired')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rnx_commercial_quote_events_quote_created_idx
  on public.rnx_commercial_quote_events(quote_id, created_at asc);
alter table public.rnx_commercial_quote_events enable row level security;
revoke all on public.rnx_commercial_quote_events from public, anon, authenticated;

-- Extend the existing notification centre without changing saved-listing notifications.
alter table public.rnx_customer_notifications
  add column if not exists related_quote_id uuid references public.rnx_commercial_quotes(id) on delete set null;
alter table public.rnx_customer_notifications
  drop constraint if exists rnx_customer_notifications_notification_type_check;
alter table public.rnx_customer_notifications
  add constraint rnx_customer_notifications_notification_type_check
  check (notification_type in ('saved_listing_changed','commercial_quote_submitted'));

comment on table public.rnx_commercial_quotes is
  'Supplier commercial proposals created only after an RNX introduction has passed payment verification, customer approval and contact release. Customer selection is a preference signal, not a contract or payment.';
comment on table public.rnx_commercial_quote_events is
  'Private immutable event history for supplier commercial quotations and customer quote decisions.';

create or replace function public.rnx_submit_commercial_quote(
  p_offer_id uuid,
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
  v_offer record;
  v_quote public.rnx_commercial_quotes%rowtype;
  v_reference text;
  v_lead_id uuid;
begin
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 60 then
    return jsonb_build_object('ok', false, 'error', 'Choose a quote validity between 1 and 60 days.');
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'The quotation amount cannot be negative.');
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object('ok', false, 'error', 'Use a valid three-letter currency code.');
  end if;

  select lead_id into v_lead_id
  from public.rnx_lead_offers
  where id = p_offer_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Supplier opportunity not found.');
  end if;
  -- Serialise all quote activity for the same customer request before locking
  -- the opportunity row. This gives submit/select operations a stable lock order.
  perform 1 from public.rnx_leads where id = v_lead_id for update;

  select
    lo.id as offer_id,
    lo.lead_id,
    lo.supplier_application_id,
    lo.payment_status,
    lo.supplier_accepted_at,
    lo.payment_verified_at,
    lo.customer_approved_at,
    lo.contact_released_at,
    lead.customer_id,
    supplier.status as supplier_status
  into v_offer
  from public.rnx_lead_offers as lo
  join public.rnx_leads as lead on lead.id = lo.lead_id
  join public.rnx_supplier_applications as supplier on supplier.id = lo.supplier_application_id
  join public.rnx_customers as customer on customer.id = lead.customer_id and customer.status = 'active'
  where lo.id = p_offer_id
  for update of lo;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'This opportunity is not linked to an active customer account.');
  end if;
  if v_offer.supplier_application_id <> p_supplier_id then
    return jsonb_build_object('ok', false, 'error', 'This opportunity does not belong to your supplier account.');
  end if;
  if v_offer.supplier_status <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'Only currently approved suppliers can submit a commercial quotation.');
  end if;
  if v_offer.customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'This introduction is not linked to a customer account and cannot receive a dashboard quotation.');
  end if;
  if v_offer.supplier_accepted_at is null
     or v_offer.payment_status <> 'paid'
     or v_offer.payment_verified_at is null
     or v_offer.customer_approved_at is null
     or v_offer.contact_released_at is null then
    return jsonb_build_object('ok', false, 'error', 'A commercial quotation is available only after supplier acceptance, payment verification, customer approval and contact release.');
  end if;
  if exists (
    select 1 from public.rnx_transaction_outcomes as outcome
    where outcome.lead_offer_id = v_offer.offer_id
      and outcome.status in ('completed','cancelled','disputed')
  ) then
    return jsonb_build_object('ok', false, 'error', 'A commercial quotation cannot be submitted after the transaction outcome has been finalised or disputed.');
  end if;
  if exists (
    select 1 from public.rnx_commercial_quotes as existing_quote
    where existing_quote.lead_offer_id = v_offer.offer_id
      and existing_quote.status in ('submitted','selected')
  ) then
    return jsonb_build_object('ok', false, 'error', 'A quotation is already awaiting the customer decision for this introduction.');
  end if;

  v_reference := 'RNXQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.rnx_commercial_quotes (
    quote_reference, lead_offer_id, lead_id, customer_id, supplier_application_id,
    title, scope_description, total_amount, currency, delivery_terms,
    estimated_fulfilment, valid_until, status
  ) values (
    v_reference, v_offer.offer_id, v_offer.lead_id, v_offer.customer_id, p_supplier_id,
    trim(p_title), trim(p_scope_description), p_total_amount, p_currency,
    trim(p_delivery_terms), nullif(trim(coalesce(p_estimated_fulfilment, '')), ''),
    now() + make_interval(days => p_valid_days), 'submitted'
  ) returning * into v_quote;

  insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
  values (v_quote.id, 'supplier', p_supplier_id, 'submitted', jsonb_build_object('quote_reference', v_quote.quote_reference, 'currency', v_quote.currency, 'total_amount', v_quote.total_amount));

  insert into public.rnx_customer_notifications (
    customer_id, notification_type, title, message, supplier_name, related_quote_id
  )
  select
    v_offer.customer_id,
    'commercial_quote_submitted',
    'New supplier quotation: ' || left(v_quote.title, 150),
    'An introduced supplier has submitted a commercial quotation. Review the amount, scope, delivery terms and validity in your customer dashboard.',
    supplier.business_name,
    v_quote.id
  from public.rnx_supplier_applications as supplier
  where supplier.id = p_supplier_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote.id, 'quote_reference', v_quote.quote_reference, 'valid_until', v_quote.valid_until);
end;
$$;

create or replace function public.rnx_respond_to_commercial_quote(
  p_quote_id uuid,
  p_customer_id uuid,
  p_decision text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.rnx_commercial_quotes%rowtype;
  v_other record;
  v_next_status text;
  v_lead_id uuid;
begin
  if p_decision is null or p_decision not in ('select','decline') then
    return jsonb_build_object('ok', false, 'error', 'Choose whether to mark the quote as preferred or decline it.');
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
  if not exists (select 1 from public.rnx_customers where id = p_customer_id and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'This customer account is not active.');
  end if;
  if not exists (
    select 1 from public.rnx_lead_offers as offer
    join public.rnx_leads as lead on lead.id = offer.lead_id
    where offer.id = v_quote.lead_offer_id
      and lead.customer_id = p_customer_id
      and offer.supplier_accepted_at is not null
      and offer.payment_status = 'paid'
      and offer.payment_verified_at is not null
      and offer.customer_approved_at is not null
      and offer.contact_released_at is not null
      and exists (select 1 from public.rnx_supplier_applications as supplier where supplier.id = offer.supplier_application_id and supplier.status = 'approved')
  ) then
    return jsonb_build_object('ok', false, 'error', 'This quote is not attached to an active authorised introduction.');
  end if;
  if v_quote.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'This quotation is no longer awaiting a customer decision.');
  end if;
  if exists (
    select 1 from public.rnx_transaction_outcomes as outcome
    where outcome.lead_offer_id = v_quote.lead_offer_id
      and outcome.status in ('completed','cancelled','disputed')
  ) then
    return jsonb_build_object('ok', false, 'error', 'A quotation cannot be selected after the transaction outcome has been finalised or disputed.');
  end if;
  if v_quote.valid_until <= now() then
    update public.rnx_commercial_quotes
    set status = 'expired', updated_at = now(), responded_at = now()
    where id = v_quote.id;
    insert into public.rnx_commercial_quote_events(quote_id, actor_role, event_type, details)
    values (v_quote.id, 'system', 'expired', '{}'::jsonb);
    return jsonb_build_object('ok', false, 'error', 'This quotation has expired. Ask the supplier to issue a new one.');
  end if;
  if v_quote.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'This quotation cannot be changed.');
  end if;

  v_next_status := case when p_decision = 'select' then 'selected' else 'declined' end;

  if p_decision = 'select' then
    -- Keep one preferred commercial proposal per sourcing request. Previous
    -- selections and competing active submissions are retained as history.
    for v_other in
      select id from public.rnx_commercial_quotes
      where lead_id = v_quote.lead_id
        and status in ('submitted','selected')
        and id <> v_quote.id
      for update
    loop
      update public.rnx_commercial_quotes
      set status = 'not_selected', updated_at = now(), responded_at = now()
      where id = v_other.id;
      insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
      values (v_other.id, 'system', p_customer_id, 'not_selected', jsonb_build_object('selected_quote_id', v_quote.id));
    end loop;
  end if;

  update public.rnx_commercial_quotes
  set status = v_next_status, updated_at = now(), responded_at = now()
  where id = v_quote.id;
  insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
  values (v_quote.id, 'customer', p_customer_id, v_next_status, '{}'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'status', v_next_status,
    'quote_reference', v_quote.quote_reference,
    'supplier_application_id', v_quote.supplier_application_id,
    'lead_id', v_quote.lead_id
  );
end;
$$;

create or replace function public.rnx_withdraw_commercial_quote(
  p_quote_id uuid,
  p_supplier_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.rnx_commercial_quotes%rowtype;
begin
  select * into v_quote
  from public.rnx_commercial_quotes
  where id = p_quote_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Commercial quotation not found.');
  end if;
  if v_quote.supplier_application_id <> p_supplier_id then
    return jsonb_build_object('ok', false, 'error', 'This quotation does not belong to your supplier account.');
  end if;
  if v_quote.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'Only a quotation awaiting the customer decision can be withdrawn.');
  end if;
  update public.rnx_commercial_quotes
  set status = 'withdrawn', updated_at = now(), responded_at = now()
  where id = v_quote.id;
  insert into public.rnx_commercial_quote_events(quote_id, actor_role, actor_id, event_type, details)
  values (v_quote.id, 'supplier', p_supplier_id, 'withdrawn', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', 'withdrawn', 'quote_reference', v_quote.quote_reference);
end;
$$;

create or replace function public.rnx_expire_commercial_quotes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
  v_count integer := 0;
begin
  for v_quote in
    update public.rnx_commercial_quotes
    set status = 'expired', updated_at = now(), responded_at = now()
    where status = 'submitted' and valid_until <= now()
    returning id
  loop
    insert into public.rnx_commercial_quote_events(quote_id, actor_role, event_type, details)
    values (v_quote.id, 'system', 'expired', '{}'::jsonb);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.rnx_submit_commercial_quote(uuid,uuid,text,text,numeric,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.rnx_respond_to_commercial_quote(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.rnx_withdraw_commercial_quote(uuid,uuid) from public, anon, authenticated;
revoke all on function public.rnx_expire_commercial_quotes() from public, anon, authenticated;
grant execute on function public.rnx_submit_commercial_quote(uuid,uuid,text,text,numeric,text,text,text,integer) to service_role;
grant execute on function public.rnx_respond_to_commercial_quote(uuid,uuid,text) to service_role;
grant execute on function public.rnx_withdraw_commercial_quote(uuid,uuid) to service_role;
grant execute on function public.rnx_expire_commercial_quotes() to service_role;
