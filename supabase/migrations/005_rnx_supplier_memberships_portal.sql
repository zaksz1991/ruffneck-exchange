-- RuffNeck Exchange v0.6.0: supplier portal, membership plans and manual billing workflow.
-- ADDITIVE ONLY. Requires RNX migrations 001–004. Does not modify non-RNX business tables.

alter table public.rnx_supplier_applications
  add column if not exists portal_password_hash text,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_invite_token_hash text,
  add column if not exists portal_invite_expires_at timestamptz;

create unique index if not exists rnx_supplier_portal_invite_hash_uidx
  on public.rnx_supplier_applications(portal_invite_token_hash)
  where portal_invite_token_hash is not null;

-- Membership catalogue. Paid-plan prices are deliberately quote-based until RNX
-- validates commercial pricing. Do not publish invented price points.
create table if not exists public.rnx_membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  listing_limit integer not null check (listing_limit between 1 and 10000),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual')),
  display_price text not null,
  price numeric(14,2),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rnx_membership_plans
  (code,name,description,listing_limit,billing_interval,display_price,price,currency,features,sort_order)
values
  ('starter','Starter','A no-cost entry level for approved businesses testing the exchange.',3,'monthly','Free',0,'NGN',
    '["Up to 3 active catalogue submissions","Business profile after approval","Receive relevant anonymised opportunities","Standard review queue"]'::jsonb,1),
  ('growth','Growth','For suppliers with a broader product or service catalogue.',25,'monthly','Request a quotation',null,'NGN',
    '["Up to 25 catalogue submissions","Business profile after approval","Supplier opportunity dashboard","Membership and catalogue status overview","Commercial terms confirmed before payment"]'::jsonb,2),
  ('enterprise','Enterprise','For larger suppliers, distributors and multi-location operations.',500,'monthly','Custom quotation',null,'NGN',
    '["Up to 500 catalogue submissions","Business profile after approval","Supplier opportunity dashboard","Multi-location catalogue capacity","Commercial terms agreed directly with RNX"]'::jsonb,3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  listing_limit = excluded.listing_limit,
  display_price = excluded.display_price,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.rnx_membership_subscriptions (
  id uuid primary key default gen_random_uuid(),
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  plan_id uuid not null references public.rnx_membership_plans(id),
  status text not null default 'requested' check (status in (
    'requested','awaiting_payment','active','past_due','suspended','cancelled','expired','superseded','rejected'
  )),
  quoted_amount numeric(14,2) check (quoted_amount is null or quoted_amount >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual')),
  quote_expires_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rnx_membership_supplier_created_idx
  on public.rnx_membership_subscriptions(supplier_application_id,created_at desc);
create index if not exists rnx_membership_status_idx
  on public.rnx_membership_subscriptions(status,created_at desc);
create unique index if not exists rnx_membership_one_pending_per_supplier_uidx
  on public.rnx_membership_subscriptions(supplier_application_id)
  where status in ('requested','awaiting_payment');

create table if not exists public.rnx_membership_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.rnx_membership_subscriptions(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','other')),
  transaction_reference text not null check (char_length(transaction_reference) between 3 and 120),
  status text not null default 'pending' check (status in ('pending','verified','rejected','refunded')),
  supplier_note text,
  received_amount numeric(14,2) check (received_amount is null or received_amount > 0),
  received_currency text check (received_currency is null or received_currency ~ '^[A-Z]{3}$'),
  verified_reference text check (verified_reference is null or char_length(verified_reference) between 3 and 120),
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rnx_membership_payment_verified_evidence_check check (
    status <> 'verified' or (received_amount is not null and received_currency is not null
      and verified_reference is not null and verified_at is not null)
  )
);
create unique index if not exists rnx_membership_payment_reference_uidx
  on public.rnx_membership_payments(lower(transaction_reference));
create index if not exists rnx_membership_payment_subscription_idx
  on public.rnx_membership_payments(subscription_id,created_at desc);
create unique index if not exists rnx_membership_payment_verified_reference_uidx
  on public.rnx_membership_payments(lower(verified_reference))
  where verified_reference is not null;

create table if not exists public.rnx_membership_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.rnx_membership_subscriptions(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rnx_membership_events_sub_created_idx
  on public.rnx_membership_events(subscription_id,created_at desc);

-- Payment verification records independent evidence from the receiving account;
-- a supplier-submitted reference is never sufficient to activate a membership.

-- Persistent, privacy-minimised supplier login throttling. The application stores
-- only an HMAC of email + IP, never raw IP addresses in this table.
create table if not exists public.rnx_supplier_auth_attempts (
  attempt_key text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.rnx_membership_plans enable row level security;
alter table public.rnx_membership_subscriptions enable row level security;
alter table public.rnx_membership_payments enable row level security;
alter table public.rnx_membership_events enable row level security;
alter table public.rnx_supplier_auth_attempts enable row level security;
revoke all on public.rnx_membership_plans, public.rnx_membership_subscriptions,
  public.rnx_membership_payments, public.rnx_membership_events,
  public.rnx_supplier_auth_attempts from anon, authenticated;
revoke all on public.rnx_supplier_applications from anon, authenticated;

-- Admin audit schema gains the membership entity type; old values remain valid.
alter table public.rnx_admin_audit_log
  drop constraint if exists rnx_admin_audit_log_entity_type_check;
alter table public.rnx_admin_audit_log
  add constraint rnx_admin_audit_log_entity_type_check
  check (entity_type in ('supplier','listing','lead','membership'));

-- Existing approved suppliers receive a Starter subscription so the portal has
-- a working, zero-cost baseline after access is claimed/enabled.
insert into public.rnx_membership_subscriptions
  (supplier_application_id,plan_id,status,quoted_amount,currency,billing_interval,period_start)
select s.id,p.id,'active',0,'NGN','monthly',now()
from public.rnx_supplier_applications s
cross join public.rnx_membership_plans p
where s.status='approved' and p.code='starter'
  and not exists (
    select 1 from public.rnx_membership_subscriptions ms
    where ms.supplier_application_id=s.id and ms.status in ('requested','awaiting_payment','active')
  );

-- New approvals also receive the Starter plan. Portal access is enabled only
-- when the supplier has a password hash; older suppliers must claim an invite.
create or replace function public.rnx_supplier_portal_approval_hook()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='approved' then
    new.portal_enabled := (new.portal_password_hash is not null);
  else
    new.portal_enabled := false;
  end if;
  return new;
end;
$$;
drop trigger if exists rnx_supplier_portal_approval_before on public.rnx_supplier_applications;
create trigger rnx_supplier_portal_approval_before
before insert or update of status,portal_password_hash on public.rnx_supplier_applications
for each row execute function public.rnx_supplier_portal_approval_hook();

create or replace function public.rnx_supplier_starter_membership_hook()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan_id uuid;
begin
  if tg_op='INSERT' then
    if new.status <> 'approved' then return new; end if;
  elsif tg_op='UPDATE' then
    if new.status <> 'approved' or old.status is not distinct from new.status then return new; end if;
  end if;
  select id into v_plan_id from public.rnx_membership_plans where code='starter' and active=true limit 1;
  if v_plan_id is not null and not exists (
    select 1 from public.rnx_membership_subscriptions ms
    where ms.supplier_application_id=new.id and ms.status in ('requested','awaiting_payment','active')
  ) then
    insert into public.rnx_membership_subscriptions
      (supplier_application_id,plan_id,status,quoted_amount,currency,billing_interval,period_start)
    values (new.id,v_plan_id,'active',0,'NGN','monthly',now());
  end if;
  return new;
end;
$$;
drop trigger if exists rnx_supplier_starter_membership_after on public.rnx_supplier_applications;
create trigger rnx_supplier_starter_membership_after
  after insert or update of status on public.rnx_supplier_applications
  for each row execute function public.rnx_supplier_starter_membership_hook();

create or replace function public.rnx_supplier_auth_is_locked(p_attempt_key text)
returns boolean language sql security definer set search_path=public as $$
  select coalesce((select locked_until > now() from public.rnx_supplier_auth_attempts where attempt_key=p_attempt_key),false);
$$;

create or replace function public.rnx_supplier_auth_register_failure(
  p_attempt_key text, p_max_attempts integer default 6,
  p_window_minutes integer default 15, p_lock_minutes integer default 30
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.rnx_supplier_auth_attempts%rowtype;
begin
  insert into public.rnx_supplier_auth_attempts as current_attempt(attempt_key,failures,window_started_at,updated_at)
    values (p_attempt_key,1,now(),now())
  on conflict (attempt_key) do update set
    failures = case when current_attempt.window_started_at < now() - make_interval(mins=>p_window_minutes)
      then 1 else current_attempt.failures + 1 end,
    window_started_at = case when current_attempt.window_started_at < now() - make_interval(mins=>p_window_minutes)
      then now() else current_attempt.window_started_at end,
    locked_until = case
      when current_attempt.locked_until > now() then current_attempt.locked_until
      when (case when current_attempt.window_started_at < now() - make_interval(mins=>p_window_minutes)
        then 1 else current_attempt.failures + 1 end) >= p_max_attempts
        then now() + make_interval(mins=>p_lock_minutes)
      else null end,
    updated_at=now()
  returning * into v_row;
  return jsonb_build_object('failures',v_row.failures,'locked_until',v_row.locked_until);
end;
$$;

create or replace function public.rnx_supplier_auth_clear(p_attempt_key text)
returns void language sql security definer set search_path=public as $$
  delete from public.rnx_supplier_auth_attempts where attempt_key=p_attempt_key;
$$;

drop function if exists public.rnx_verify_membership_payment(uuid,text);
create or replace function public.rnx_verify_membership_payment(
  p_payment_id uuid,
  p_received_amount numeric,
  p_received_currency text,
  p_verified_reference text,
  p_verified_by text default 'rnx-admin'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_payment public.rnx_membership_payments%rowtype;
  v_subscription public.rnx_membership_subscriptions%rowtype;
  v_interval text;
  v_reference text;
begin
  select * into v_payment from public.rnx_membership_payments where id=p_payment_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Payment record not found.'); end if;
  if v_payment.status='verified' then return jsonb_build_object('ok',true,'already_verified',true); end if;
  if v_payment.status <> 'pending' then return jsonb_build_object('ok',false,'error','This payment is not pending verification.'); end if;

  select * into v_subscription from public.rnx_membership_subscriptions where id=v_payment.subscription_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Membership request not found.'); end if;
  if v_subscription.status <> 'awaiting_payment' then return jsonb_build_object('ok',false,'error','Membership is not awaiting payment.'); end if;
  if v_subscription.quote_expires_at is not null and v_subscription.quote_expires_at < now() then
    return jsonb_build_object('ok',false,'error','The membership quotation has expired. Issue a fresh quotation first.');
  end if;
  v_reference := nullif(trim(coalesce(p_verified_reference,'')),'');
  if v_reference is null or length(v_reference)<3 or length(v_reference)>120 then
    return jsonb_build_object('ok',false,'error','Enter the actual bank or payment-provider reference confirmed in the receiving account.');
  end if;
  if p_received_amount is null or p_received_currency is null or v_subscription.quoted_amount is null
     or p_received_amount <> v_subscription.quoted_amount
     or upper(trim(p_received_currency)) <> upper(v_subscription.currency)
     or v_payment.amount <> v_subscription.quoted_amount
     or v_payment.currency <> v_subscription.currency then
    return jsonb_build_object('ok',false,'error','The independently confirmed amount and currency must exactly match the current quotation.');
  end if;

  update public.rnx_membership_payments
    set status='verified',received_amount=p_received_amount,received_currency=upper(trim(p_received_currency)),
        verified_reference=v_reference,verified_at=now(),verified_by=p_verified_by,updated_at=now()
    where id=v_payment.id;
  update public.rnx_membership_subscriptions
    set status='superseded',updated_at=now()
    where supplier_application_id=v_subscription.supplier_application_id
      and status='active' and id<>v_subscription.id;
  select billing_interval into v_interval from public.rnx_membership_subscriptions where id=v_subscription.id;
  update public.rnx_membership_subscriptions
    set status='active',period_start=now(),
        period_end=case when v_interval='annual' then now()+interval '1 year' else now()+interval '1 month' end,
        updated_at=now()
    where id=v_subscription.id;
  insert into public.rnx_membership_events(subscription_id,event_type,details)
    values (v_subscription.id,'payment_verified',jsonb_build_object('payment_id',v_payment.id,'supplier_reference',v_payment.transaction_reference,'verified_reference',v_reference,'received_amount',p_received_amount,'received_currency',upper(trim(p_received_currency))));
  return jsonb_build_object('ok',true,'already_verified',false);
end;
$$;

revoke all on function public.rnx_supplier_auth_is_locked(text) from public,anon,authenticated;
revoke all on function public.rnx_supplier_auth_register_failure(text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.rnx_supplier_auth_clear(text) from public,anon,authenticated;
revoke all on function public.rnx_verify_membership_payment(uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.rnx_supplier_auth_is_locked(text) to service_role;
grant execute on function public.rnx_supplier_auth_register_failure(text,integer,integer,integer) to service_role;
grant execute on function public.rnx_supplier_auth_clear(text) to service_role;
grant execute on function public.rnx_verify_membership_payment(uuid,numeric,text,text,text) to service_role;

comment on table public.rnx_membership_subscriptions is
  'Private supplier membership history and quote-to-payment lifecycle. Paid access activates only after operations verifies the matching payment.';
comment on table public.rnx_membership_payments is
  'Supplier-submitted payment references. A submitted reference is not proof of receipt; only RNX operations can verify.';
comment on column public.rnx_supplier_applications.portal_password_hash is
  'Scrypt password hash only. Plain-text supplier passwords must never be stored.';

-- Supplier-side response to anonymised lead offers.
alter table public.rnx_lead_offers
  add column if not exists supplier_declined_at timestamptz,
  add column if not exists supplier_response_note text;

alter table public.rnx_lead_offer_events
  drop constraint if exists rnx_lead_offer_events_event_type_check;
alter table public.rnx_lead_offer_events
  add constraint rnx_lead_offer_events_event_type_check
  check (event_type in (
    'offer_created','supplier_accepted','supplier_declined','customer_approved','customer_declined',
    'payment_verified','payment_refunded','payment_credited','contact_released'
  ));

create or replace function public.rnx_supplier_respond_to_offer(
  p_offer_id uuid, p_supplier_id uuid, p_decision text, p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_offer public.rnx_lead_offers%rowtype;
begin
  if p_decision not in ('accept','decline') then
    return jsonb_build_object('ok',false,'error','Invalid offer decision.');
  end if;
  select * into v_offer from public.rnx_lead_offers
    where id=p_offer_id and supplier_application_id=p_supplier_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Opportunity offer not found.'); end if;
  if v_offer.customer_declined_at is not null or v_offer.payment_status in ('refunded','credited') then
    return jsonb_build_object('ok',false,'error','This opportunity is no longer active.');
  end if;
  if p_decision='accept' then
    if v_offer.supplier_declined_at is not null then
      return jsonb_build_object('ok',false,'error','This offer was already declined. Ask RNX operations to review it.');
    end if;
    if v_offer.supplier_accepted_at is not null then
      return jsonb_build_object('ok',true,'decision','accepted','already_recorded',true);
    end if;
    update public.rnx_lead_offers set supplier_accepted_at=now(),supplier_response_note=null where id=v_offer.id;
    insert into public.rnx_lead_offer_events(lead_offer_id,event_type,details)
      values (v_offer.id,'supplier_accepted',jsonb_build_object('source','supplier_portal'));
    return jsonb_build_object('ok',true,'decision','accepted','already_recorded',false);
  end if;

  if v_offer.supplier_accepted_at is not null or v_offer.payment_verified_at is not null
     or v_offer.customer_approved_at is not null or v_offer.contact_released_at is not null then
    return jsonb_build_object('ok',false,'error','This offer has progressed too far to be declined in the supplier portal. Contact RNX operations.');
  end if;
  if v_offer.supplier_declined_at is not null then
    return jsonb_build_object('ok',true,'decision','declined','already_recorded',true);
  end if;
  update public.rnx_lead_offers
    set supplier_declined_at=now(),supplier_response_note=nullif(left(trim(coalesce(p_note,'')),500),'')
    where id=v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id,event_type,details)
    values (v_offer.id,'supplier_declined',jsonb_build_object('source','supplier_portal','note',nullif(left(trim(coalesce(p_note,'')),500),'')));
  return jsonb_build_object('ok',true,'decision','declined','already_recorded',false);
end;
$$;

-- Prevent an operator from accepting an offer after the supplier declined it.
create or replace function public.rnx_record_supplier_acceptance(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_offer public.rnx_lead_offers%rowtype;
begin
  select * into v_offer from public.rnx_lead_offers where id=p_offer_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Offer not found.'); end if;
  if v_offer.supplier_declined_at is not null then return jsonb_build_object('ok',false,'error','The supplier declined this offer.'); end if;
  if v_offer.payment_status in ('refunded','credited') then return jsonb_build_object('ok',false,'error','A refunded or credited offer cannot be accepted again.'); end if;
  if v_offer.customer_declined_at is not null then return jsonb_build_object('ok',false,'error','The customer declined this introduction.'); end if;
  if v_offer.supplier_accepted_at is not null then return jsonb_build_object('ok',true,'already_accepted',true); end if;
  update public.rnx_lead_offers set supplier_accepted_at=now() where id=v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id,event_type) values (v_offer.id,'supplier_accepted');
  return jsonb_build_object('ok',true,'already_accepted',false);
end;
$$;

-- A previously issued customer link cannot revive a supplier-declined offer.
create or replace function public.rnx_respond_to_introduction(p_token_hash text,p_decision text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_offer public.rnx_lead_offers%rowtype; v_supplier_name text; v_event text;
begin
  if p_decision not in ('approved','declined') then return jsonb_build_object('ok',false,'error','Invalid decision.'); end if;
  select * into v_offer from public.rnx_lead_offers where customer_approval_token_hash=p_token_hash for update;
  if not found then return jsonb_build_object('ok',false,'error','This approval link is invalid.'); end if;
  select business_name into v_supplier_name from public.rnx_supplier_applications where id=v_offer.supplier_application_id;
  if v_offer.customer_approved_at is not null then return jsonb_build_object('ok',true,'decision','approved','supplier',v_supplier_name); end if;
  if v_offer.customer_declined_at is not null then return jsonb_build_object('ok',true,'decision','declined','supplier',v_supplier_name); end if;
  if v_offer.supplier_declined_at is not null then return jsonb_build_object('ok',false,'error','This supplier is no longer available for the requested introduction. RNX will review another option.'); end if;
  if v_offer.payment_status in ('refunded','credited') then return jsonb_build_object('ok',false,'error','This supplier offer is no longer active.'); end if;
  if v_offer.customer_approval_token_expires_at is null or v_offer.customer_approval_token_expires_at<=now() then
    return jsonb_build_object('ok',false,'error','This approval link has expired. Contact RuffNeck Exchange for a new link.');
  end if;
  if p_decision='approved' then
    update public.rnx_lead_offers set customer_approved_at=now() where id=v_offer.id;
    update public.rnx_leads set contact_release_status='customer_approved' where id=v_offer.lead_id and contact_release_status<>'released';
    v_event := 'customer_approved';
  else
    update public.rnx_lead_offers set customer_declined_at=now() where id=v_offer.id;
    v_event := 'customer_declined';
  end if;
  insert into public.rnx_lead_offer_events(lead_offer_id,event_type) values (v_offer.id,v_event);
  return jsonb_build_object('ok',true,'decision',p_decision,'supplier',v_supplier_name);
end;
$$;

revoke all on function public.rnx_supplier_respond_to_offer(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rnx_supplier_respond_to_offer(uuid,uuid,text,text) to service_role;
revoke all on function public.rnx_record_supplier_acceptance(uuid) from public,anon,authenticated;
grant execute on function public.rnx_record_supplier_acceptance(uuid) to service_role;
revoke all on function public.rnx_respond_to_introduction(text,text) from public,anon,authenticated;
grant execute on function public.rnx_respond_to_introduction(text,text) to service_role;

-- Supplier-declined opportunities cannot be charged or advanced to contact release.
create or replace function public.rnx_verify_offer_payment(p_offer_id uuid,p_payment_reference text,p_payment_amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_offer public.rnx_lead_offers%rowtype;
begin
  select * into v_offer from public.rnx_lead_offers where id=p_offer_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Offer not found.'); end if;
  if v_offer.payment_status='paid' and v_offer.payment_verified_at is not null then return jsonb_build_object('ok',true,'already_paid',true); end if;
  if v_offer.supplier_declined_at is not null then return jsonb_build_object('ok',false,'error','The supplier declined this opportunity.'); end if;
  if v_offer.supplier_accepted_at is null then return jsonb_build_object('ok',false,'error','Record supplier acceptance before verifying payment.'); end if;
  if v_offer.customer_declined_at is not null then return jsonb_build_object('ok',false,'error','The customer declined this introduction. Do not collect payment for it.'); end if;
  if length(trim(coalesce(p_payment_reference,'')))<3 or length(trim(p_payment_reference))>120 then return jsonb_build_object('ok',false,'error','A valid transaction reference is required.'); end if;
  if p_payment_amount is null or p_payment_amount<>v_offer.quoted_fee then return jsonb_build_object('ok',false,'error','The received amount must exactly match the agreed supplier fee.'); end if;
  if v_offer.payment_status in ('refunded','credited') then return jsonb_build_object('ok',false,'error','This offer has already been refunded or credited.'); end if;
  update public.rnx_lead_offers set payment_status='paid',payment_verified_at=now(),payment_reference=trim(p_payment_reference),payment_amount=p_payment_amount where id=v_offer.id;
  insert into public.rnx_lead_offer_events(lead_offer_id,event_type,reference,details)
    values (v_offer.id,'payment_verified',trim(p_payment_reference),jsonb_build_object('amount',p_payment_amount));
  return jsonb_build_object('ok',true,'already_paid',false);
end;
$$;
revoke all on function public.rnx_verify_offer_payment(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.rnx_verify_offer_payment(uuid,text,numeric) to service_role;

-- Expired paid memberships fall back to the free Starter plan. No recurring
-- payment is collected automatically; suppliers must request/agree to renewal.
create or replace function public.rnx_refresh_supplier_membership(p_supplier_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_plan_id uuid;
begin
  update public.rnx_membership_subscriptions
    set status='expired',updated_at=now()
    where supplier_application_id=p_supplier_id and status='active'
      and period_end is not null and period_end<=now();
  if exists (select 1 from public.rnx_supplier_applications where id=p_supplier_id and status='approved')
     and not exists (select 1 from public.rnx_membership_subscriptions where supplier_application_id=p_supplier_id and status='active') then
    select id into v_plan_id from public.rnx_membership_plans where code='starter' and active=true limit 1;
    if v_plan_id is not null then
      insert into public.rnx_membership_subscriptions
        (supplier_application_id,plan_id,status,quoted_amount,currency,billing_interval,period_start)
      values (p_supplier_id,v_plan_id,'active',0,'NGN','monthly',now());
    end if;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.rnx_refresh_supplier_membership(uuid) from public,anon,authenticated;
grant execute on function public.rnx_refresh_supplier_membership(uuid) to service_role;
