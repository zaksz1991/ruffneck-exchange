-- RuffNeck Exchange v3.1.0: independently confirmed transaction outcomes and verified supplier reviews.
-- Additive only. Requires the cumulative RNX schema through migration 022.
-- A review is eligible only after both the customer and supplier confirm completion
-- of an authorised, paid and contact-released introduction.

create table if not exists public.rnx_transaction_outcomes (
  id uuid primary key default gen_random_uuid(),
  lead_offer_id uuid not null unique references public.rnx_lead_offers(id) on delete cascade,
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  customer_outcome text check (customer_outcome in ('completed','not_completed')),
  supplier_outcome text check (supplier_outcome in ('completed','not_completed')),
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation','completed','cancelled','disputed')),
  customer_confirmed_at timestamptz,
  supplier_confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rnx_transaction_outcomes_customer_created_idx
  on public.rnx_transaction_outcomes(customer_id, created_at desc);
create index if not exists rnx_transaction_outcomes_supplier_created_idx
  on public.rnx_transaction_outcomes(supplier_application_id, created_at desc);
create index if not exists rnx_transaction_outcomes_status_idx
  on public.rnx_transaction_outcomes(status, updated_at desc);

alter table public.rnx_transaction_outcomes enable row level security;
revoke all on public.rnx_transaction_outcomes from anon, authenticated;

create table if not exists public.rnx_supplier_reviews (
  id uuid primary key default gen_random_uuid(),
  lead_offer_id uuid not null unique references public.rnx_lead_offers(id) on delete cascade,
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(trim(body)) between 20 and 2000),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','rejected','hidden')),
  moderated_at timestamptz,
  moderated_by_staff_id uuid references public.rnx_staff_users(id) on delete set null,
  supplier_response text check (supplier_response is null or char_length(trim(supplier_response)) between 2 and 1000),
  supplier_response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rnx_supplier_reviews_public_idx
  on public.rnx_supplier_reviews(supplier_application_id, created_at desc)
  where moderation_status = 'approved';
create index if not exists rnx_supplier_reviews_moderation_idx
  on public.rnx_supplier_reviews(moderation_status, created_at asc);

alter table public.rnx_supplier_reviews enable row level security;
revoke all on public.rnx_supplier_reviews from anon, authenticated;

-- Only the service-role API can call this function. It verifies the actor against
-- the lead's customer account or the supplier that owns the matched offer.
create or replace function public.rnx_confirm_transaction_outcome(
  p_offer_id uuid,
  p_actor_role text,
  p_actor_id uuid,
  p_outcome text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rnx_lead_offers%rowtype;
  v_customer_id uuid;
  v_outcome public.rnx_transaction_outcomes%rowtype;
  v_next_status text;
begin
  if p_actor_role not in ('customer','supplier') then
    return jsonb_build_object('ok', false, 'error', 'Invalid confirmation actor.');
  end if;
  if p_outcome not in ('completed','not_completed') then
    return jsonb_build_object('ok', false, 'error', 'Choose a valid transaction outcome.');
  end if;

  select lo.* into v_offer
  from public.rnx_lead_offers lo
  where lo.id = p_offer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Introduced opportunity not found.');
  end if;

  select l.customer_id into v_customer_id
  from public.rnx_leads l
  where l.id = v_offer.lead_id;
  if v_offer.payment_status <> 'paid' or v_offer.payment_verified_at is null
     or v_offer.customer_approved_at is null or v_offer.contact_released_at is null then
    return jsonb_build_object('ok', false, 'error', 'Transaction confirmation is available only after payment verification, customer approval and contact release.');
  end if;
  if v_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'This request is not linked to a customer account and cannot qualify for a verified review.');
  end if;
  if p_actor_role = 'customer' and p_actor_id <> v_customer_id then
    return jsonb_build_object('ok', false, 'error', 'This introduction does not belong to your customer account.');
  end if;
  if p_actor_role = 'supplier' and p_actor_id <> v_offer.supplier_application_id then
    return jsonb_build_object('ok', false, 'error', 'This introduction does not belong to your supplier account.');
  end if;

  insert into public.rnx_transaction_outcomes(lead_offer_id, customer_id, supplier_application_id)
  values (v_offer.id, v_customer_id, v_offer.supplier_application_id)
  on conflict (lead_offer_id) do nothing;

  select * into v_outcome from public.rnx_transaction_outcomes
  where lead_offer_id = v_offer.id for update;

  if p_actor_role = 'customer' then
    if v_outcome.customer_outcome is not null then
      if v_outcome.customer_outcome <> p_outcome then
        return jsonb_build_object('ok', false, 'error', 'Your transaction outcome has already been recorded and cannot be changed. Contact RNX Operations if it is incorrect.');
      end if;
    else
      update public.rnx_transaction_outcomes
      set customer_outcome = p_outcome, customer_confirmed_at = now(), updated_at = now()
      where id = v_outcome.id;
    end if;
  else
    if v_outcome.supplier_outcome is not null then
      if v_outcome.supplier_outcome <> p_outcome then
        return jsonb_build_object('ok', false, 'error', 'Your transaction outcome has already been recorded and cannot be changed. Contact RNX Operations if it is incorrect.');
      end if;
    else
      update public.rnx_transaction_outcomes
      set supplier_outcome = p_outcome, supplier_confirmed_at = now(), updated_at = now()
      where id = v_outcome.id;
    end if;
  end if;

  select * into v_outcome from public.rnx_transaction_outcomes
  where id = v_outcome.id;

  if v_outcome.customer_outcome is not null and v_outcome.supplier_outcome is not null then
    if v_outcome.customer_outcome = 'completed' and v_outcome.supplier_outcome = 'completed' then
      v_next_status := 'completed';
    elsif v_outcome.customer_outcome = 'not_completed' and v_outcome.supplier_outcome = 'not_completed' then
      v_next_status := 'cancelled';
    else
      v_next_status := 'disputed';
    end if;
  else
    v_next_status := 'awaiting_confirmation';
  end if;

  update public.rnx_transaction_outcomes
  set status = v_next_status,
      completed_at = case when v_next_status = 'completed' then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = v_outcome.id;

  return jsonb_build_object(
    'ok', true,
    'status', v_next_status,
    'customer_outcome', v_outcome.customer_outcome,
    'supplier_outcome', v_outcome.supplier_outcome
  );
end;
$$;

revoke all on function public.rnx_confirm_transaction_outcome(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.rnx_confirm_transaction_outcome(uuid,text,uuid,text) to service_role;

-- Database guard: even a mistaken server route cannot create an unverified review.
create or replace function public.rnx_guard_verified_supplier_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  if tg_op = 'INSERT' then
    select exists (
      select 1 from public.rnx_transaction_outcomes o
      where o.lead_offer_id = new.lead_offer_id
        and o.customer_id = new.customer_id
        and o.supplier_application_id = new.supplier_application_id
        and o.status = 'completed'
    ) into v_valid;
    if not v_valid then
      raise exception 'A verified review requires matching customer and supplier completion confirmations';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rnx_supplier_review_verified_guard on public.rnx_supplier_reviews;
create trigger rnx_supplier_review_verified_guard
before insert on public.rnx_supplier_reviews
for each row execute function public.rnx_guard_verified_supplier_review();

comment on table public.rnx_transaction_outcomes is
  'Private two-party transaction outcome confirmations. Verified completion requires both the customer and matched supplier to confirm.';
comment on table public.rnx_supplier_reviews is
  'Supplier reviews submitted only against a transaction independently confirmed completed by both parties; public visibility requires RNX moderation approval.';
