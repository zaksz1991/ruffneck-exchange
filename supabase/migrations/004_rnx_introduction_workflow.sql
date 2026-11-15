-- RuffNeck Exchange v0.5.0: paid, consent-based supplier introductions.
-- Additive migration. Requires migrations 001, 002 and 003.
-- Creates only RNX-prefixed objects and does not modify unrelated RuffNeck tables.

alter table public.rnx_lead_offers
  add column if not exists customer_approval_token_hash text,
  add column if not exists customer_approval_token_expires_at timestamptz,
  add column if not exists customer_declined_at timestamptz,
  add column if not exists supplier_accepted_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists payment_amount numeric(14,2),
  add column if not exists currency text not null default 'NGN';

create unique index if not exists rnx_offer_customer_token_uidx
  on public.rnx_lead_offers(customer_approval_token_hash)
  where customer_approval_token_hash is not null;

create unique index if not exists rnx_offer_payment_reference_uidx
  on public.rnx_lead_offers(payment_reference)
  where payment_reference is not null;

create table if not exists public.rnx_lead_offer_events (
  id uuid primary key default gen_random_uuid(),
  lead_offer_id uuid not null references public.rnx_lead_offers(id) on delete cascade,
  event_type text not null check (event_type in (
    'offer_created', 'supplier_accepted', 'customer_approved', 'customer_declined',
    'payment_verified', 'payment_refunded', 'payment_credited', 'contact_released'
  )),
  reference text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rnx_offer_events_created_idx
  on public.rnx_lead_offer_events(lead_offer_id, created_at desc);

alter table public.rnx_lead_offer_events enable row level security;
revoke all on public.rnx_lead_offer_events from anon, authenticated;
revoke all on public.rnx_lead_offers from anon, authenticated;

-- Customer approval is a one-time decision tied to an unguessable, expiring token.
-- The function returns no customer contact information.
create or replace function public.rnx_respond_to_introduction(
  p_token_hash text,
  p_decision text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
  v_supplier_name text;
  v_event text;
begin
  if p_decision not in ('approved', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'Invalid decision.');
  end if;

  select lo.* into v_offer
  from public.rnx_lead_offers lo
  where lo.customer_approval_token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'This approval link is invalid.');
  end if;

  select sa.business_name into v_supplier_name
  from public.rnx_supplier_applications sa
  where sa.id = v_offer.supplier_application_id;

  if v_offer.customer_approved_at is not null then
    return jsonb_build_object('ok', true, 'decision', 'approved', 'supplier', v_supplier_name);
  end if;
  if v_offer.customer_declined_at is not null then
    return jsonb_build_object('ok', true, 'decision', 'declined', 'supplier', v_supplier_name);
  end if;
  if v_offer.payment_status in ('refunded', 'credited') then
    return jsonb_build_object('ok', false, 'error', 'This supplier offer is no longer active.');
  end if;
  if v_offer.customer_approval_token_expires_at is null or v_offer.customer_approval_token_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'This approval link has expired. Contact RuffNeck Exchange for a new link.');
  end if;

  if p_decision = 'approved' then
    update public.rnx_lead_offers
      set customer_approved_at = now()
      where id = v_offer.id;
    update public.rnx_leads
      set contact_release_status = 'customer_approved'
      where id = v_offer.lead_id and contact_release_status <> 'released';
    v_event := 'customer_approved';
  else
    update public.rnx_lead_offers
      set customer_declined_at = now()
      where id = v_offer.id;
    v_event := 'customer_declined';
  end if;

  insert into public.rnx_lead_offer_events(lead_offer_id, event_type)
    values (v_offer.id, v_event);

  return jsonb_build_object('ok', true, 'decision', p_decision, 'supplier', v_supplier_name);
end;
$$;

revoke all on function public.rnx_respond_to_introduction(text, text) from public, anon, authenticated;
grant execute on function public.rnx_respond_to_introduction(text, text) to service_role;


-- An operator records supplier acceptance after the supplier agrees to the fee/terms.
create or replace function public.rnx_record_supplier_acceptance(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
begin
  select lo.* into v_offer from public.rnx_lead_offers lo where lo.id = p_offer_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Offer not found.'); end if;
  if v_offer.payment_status in ('refunded', 'credited') then
    return jsonb_build_object('ok', false, 'error', 'A refunded or credited offer cannot be accepted again.');
  end if;
  if v_offer.customer_declined_at is not null then
    return jsonb_build_object('ok', false, 'error', 'The customer declined this introduction.');
  end if;
  if v_offer.supplier_accepted_at is not null then return jsonb_build_object('ok', true, 'already_accepted', true); end if;
  update public.rnx_lead_offers set supplier_accepted_at = now() where id = v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id, event_type) values (v_offer.id, 'supplier_accepted');
  return jsonb_build_object('ok', true, 'already_accepted', false);
end;
$$;

revoke all on function public.rnx_record_supplier_acceptance(uuid) from public, anon, authenticated;
grant execute on function public.rnx_record_supplier_acceptance(uuid) to service_role;

-- Payment must match the agreed lead fee and follow supplier acceptance.
create or replace function public.rnx_verify_offer_payment(
  p_offer_id uuid,
  p_payment_reference text,
  p_payment_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
begin
  select lo.* into v_offer from public.rnx_lead_offers lo where lo.id = p_offer_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Offer not found.'); end if;
  if v_offer.payment_status = 'paid' and v_offer.payment_verified_at is not null then
    return jsonb_build_object('ok', true, 'already_paid', true);
  end if;
  if v_offer.supplier_accepted_at is null then
    return jsonb_build_object('ok', false, 'error', 'Record supplier acceptance before verifying payment.');
  end if;
  if v_offer.customer_declined_at is not null then
    return jsonb_build_object('ok', false, 'error', 'The customer declined this introduction. Do not collect payment for it.');
  end if;
  if length(trim(coalesce(p_payment_reference, ''))) < 3 or length(trim(p_payment_reference)) > 120 then
    return jsonb_build_object('ok', false, 'error', 'A valid transaction reference is required.');
  end if;
  if p_payment_amount is null or p_payment_amount <> v_offer.quoted_fee then
    return jsonb_build_object('ok', false, 'error', 'The received amount must exactly match the agreed supplier fee.');
  end if;
  if v_offer.payment_status in ('refunded', 'credited') then
    return jsonb_build_object('ok', false, 'error', 'This offer has already been refunded or credited.');
  end if;
  update public.rnx_lead_offers
    set payment_status = 'paid', payment_verified_at = now(),
        payment_reference = trim(p_payment_reference), payment_amount = p_payment_amount
    where id = v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id, event_type, reference, details)
    values (v_offer.id, 'payment_verified', trim(p_payment_reference), jsonb_build_object('amount', p_payment_amount));
  return jsonb_build_object('ok', true, 'already_paid', false);
end;
$$;

revoke all on function public.rnx_verify_offer_payment(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.rnx_verify_offer_payment(uuid, text, numeric) to service_role;

create or replace function public.rnx_adjust_offer_payment(
  p_offer_id uuid,
  p_action text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
  v_status text;
  v_event text;
begin
  if p_action not in ('refund', 'credit') then return jsonb_build_object('ok', false, 'error', 'Invalid payment adjustment.'); end if;
  select lo.* into v_offer from public.rnx_lead_offers lo where lo.id = p_offer_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Offer not found.'); end if;
  if v_offer.payment_status <> 'paid' then return jsonb_build_object('ok', false, 'error', 'Only verified payments can be refunded or credited.'); end if;
  if v_offer.contact_released_at is not null then return jsonb_build_object('ok', false, 'error', 'Contact has already been released. Handle the dispute under the documented policy.'); end if;
  if p_action = 'refund' then v_status := 'refunded'; v_event := 'payment_refunded'; else v_status := 'credited'; v_event := 'payment_credited'; end if;
  update public.rnx_lead_offers set payment_status = v_status where id = v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id, event_type, reference)
    values (v_offer.id, v_event, nullif(trim(coalesce(p_reference, '')), ''));
  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

revoke all on function public.rnx_adjust_offer_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rnx_adjust_offer_payment(uuid, text, text) to service_role;

-- A contact-release record cannot be created unless payment and customer consent
-- have both been recorded. This function provides a single atomic operation.
create or replace function public.rnx_record_contact_release(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
begin
  select lo.* into v_offer
  from public.rnx_lead_offers lo
  where lo.id = p_offer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if v_offer.payment_status <> 'paid' or v_offer.payment_verified_at is null then
    return jsonb_build_object('ok', false, 'error', 'Payment must be verified before contact release.');
  end if;
  if v_offer.customer_approved_at is null then
    return jsonb_build_object('ok', false, 'error', 'Customer approval is required before contact release.');
  end if;
  if v_offer.contact_released_at is not null then
    return jsonb_build_object('ok', true, 'already_released', true);
  end if;

  update public.rnx_lead_offers
    set contact_released_at = now()
    where id = v_offer.id;
  update public.rnx_leads
    set contact_release_status = 'released'
    where id = v_offer.lead_id;
  insert into public.rnx_lead_offer_events(lead_offer_id, event_type)
    values (v_offer.id, 'contact_released');

  return jsonb_build_object('ok', true, 'already_released', false);
end;
$$;

revoke all on function public.rnx_record_contact_release(uuid) from public, anon, authenticated;
grant execute on function public.rnx_record_contact_release(uuid) to service_role;

comment on table public.rnx_lead_offer_events is
  'Private event history for quote offers, payment verification, customer decisions and contact release.';
