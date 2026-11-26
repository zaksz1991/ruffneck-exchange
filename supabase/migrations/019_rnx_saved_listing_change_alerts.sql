-- RuffNeck Exchange v2.7.0: customer opt-in alerts for saved-offer price and availability changes.
-- Additive RNX-only migration. Apply after migrations 001-018 in RuffNeck Entertainment.
-- Alert emails enter the existing rnx_notifications outbox and use the existing Resend worker.

alter table public.rnx_customer_saved_listings
  add column if not exists alerts_enabled boolean not null default false,
  add column if not exists last_alert_price_type text,
  add column if not exists last_alert_price numeric(14,2),
  add column if not exists last_alert_currency text,
  add column if not exists last_alert_availability_status text;

comment on column public.rnx_customer_saved_listings.alerts_enabled is
  'Explicit customer opt-in to email when a saved public listing changes its published price or supplier-reported availability.';
comment on column public.rnx_customer_saved_listings.last_alert_price_type is
  'Last price type captured when customer enables alerts or a change alert is queued.';
comment on column public.rnx_customer_saved_listings.last_alert_price is
  'Last price captured when customer enables alerts or a change alert is queued.';
comment on column public.rnx_customer_saved_listings.last_alert_currency is
  'Last currency captured when customer enables alerts or a change alert is queued.';
comment on column public.rnx_customer_saved_listings.last_alert_availability_status is
  'Last supplier-reported availability captured when customer enables alerts or a change alert is queued.';

create index if not exists rnx_customer_saved_listings_alerts_listing_idx
  on public.rnx_customer_saved_listings(listing_id)
  where alerts_enabled = true;

create or replace function public.rnx_set_customer_listing_alert(
  p_customer_id uuid,
  p_listing_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer := 0;
begin
  if p_customer_id is null or p_listing_id is null or p_enabled is null then
    return false;
  end if;

  if p_enabled then
    -- Baseline the current published values at opt-in time so old changes are not
    -- incorrectly reported as new alerts.
    update public.rnx_customer_saved_listings as saved
    set alerts_enabled = true,
        last_alert_price_type = listing.price_type,
        last_alert_price = listing.price,
        last_alert_currency = listing.currency,
        last_alert_availability_status = listing.availability_status
    from public.rnx_listings as listing
    join public.rnx_supplier_applications as supplier
      on supplier.id = listing.supplier_application_id
    where saved.customer_id = p_customer_id
      and saved.listing_id = p_listing_id
      and listing.id = saved.listing_id
      and listing.status = 'approved'
      and supplier.status = 'approved'
      and supplier.public_slug is not null;
  else
    -- Turning alerts off must remain possible even if the saved listing has since
    -- been paused, removed from the public catalogue or is no longer approved.
    update public.rnx_customer_saved_listings
    set alerts_enabled = false
    where customer_id = p_customer_id
      and listing_id = p_listing_id;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.rnx_set_customer_listing_alert(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rnx_set_customer_listing_alert(uuid, uuid, boolean) to service_role;

create or replace function public.rnx_notify_saved_listing_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_watch record;
  v_changes text;
  v_old_price text;
  v_new_price text;
  v_old_availability text;
  v_new_availability text;
  v_republished boolean;
begin
  v_republished := (new.status = 'approved' and old.status is distinct from 'approved');

  if new.status <> 'approved' then
    return new;
  end if;

  -- Supplier catalogue edits return to moderation while paused. Compare their
  -- current approved values with the customer's saved baseline when republished.
  if row(new.price_type, new.price, new.currency, new.availability_status)
       is not distinct from row(old.price_type, old.price, old.currency, old.availability_status)
     and not v_republished then
    return new;
  end if;

  for v_watch in
    select
      saved.id as saved_id,
      saved.last_alert_price_type,
      saved.last_alert_price,
      saved.last_alert_currency,
      saved.last_alert_availability_status,
      customer.name as customer_name,
      customer.email as customer_email,
      supplier.business_name
    from public.rnx_customer_saved_listings as saved
    join public.rnx_customers as customer on customer.id = saved.customer_id
    join public.rnx_supplier_applications as supplier on supplier.id = new.supplier_application_id
    where saved.listing_id = new.id
      and saved.alerts_enabled = true
      and customer.status = 'active'
      and customer.email_verified_at is not null
      and supplier.status = 'approved'
      and supplier.public_slug is not null
    order by saved.created_at asc
    for update of saved
  loop
    v_changes := '';

    if v_watch.last_alert_price_type is distinct from new.price_type
       or v_watch.last_alert_price is distinct from new.price
       or v_watch.last_alert_currency is distinct from new.currency then
      v_old_price := case
        when v_watch.last_alert_price_type = 'enquiry' or v_watch.last_alert_price is null then 'Price on request'
        else coalesce(v_watch.last_alert_currency, 'NGN') || ' ' || v_watch.last_alert_price::text
      end;
      v_new_price := case
        when new.price_type = 'enquiry' or new.price is null then 'Price on request'
        else coalesce(new.currency, 'NGN') || ' ' || new.price::text
      end;
      v_changes := v_changes || 'Price changed from ' || v_old_price || ' to ' || v_new_price || '.';
    end if;

    if v_watch.last_alert_availability_status is distinct from new.availability_status then
      v_old_availability := case v_watch.last_alert_availability_status
        when 'available' then 'Available'
        when 'limited' then 'Limited availability'
        when 'on_request' then 'Confirm on request'
        when 'out_of_stock' then 'Currently unavailable'
        when 'unconfirmed' then 'Not confirmed'
        else coalesce(initcap(replace(v_watch.last_alert_availability_status, '_', ' ')), 'Not confirmed')
      end;
      v_new_availability := case new.availability_status
        when 'available' then 'Available'
        when 'limited' then 'Limited availability'
        when 'on_request' then 'Confirm on request'
        when 'out_of_stock' then 'Currently unavailable'
        when 'unconfirmed' then 'Not confirmed'
        else coalesce(initcap(replace(new.availability_status, '_', ' ')), 'Not confirmed')
      end;
      if v_changes <> '' then v_changes := v_changes || E'\n'; end if;
      v_changes := v_changes || 'Supplier-reported availability changed from ' || v_old_availability || ' to ' || v_new_availability || '.';
    end if;

    if v_changes <> '' then
      begin
        insert into public.rnx_notifications (
          channel, recipient_email, subject, body_text, status
        ) values (
          'email',
          lower(trim(v_watch.customer_email)),
          'Saved offer update: ' || left(new.title, 180),
          format(
            E'Hello %s,\n\nAn offer you saved on RuffNeck Exchange has changed.\n\nOffer: %s\nSupplier: %s\n\n%s\n\nPrice and availability are supplier-reported. RNX does not independently verify stock, price, product quality or delivery.\n\nTo stop these emails, sign in to your RNX customer dashboard and turn off email alerts for this saved offer.',
            coalesce(v_watch.customer_name, 'RNX customer'),
            new.title,
            v_watch.business_name,
            v_changes
          ),
          'pending'
        );

        update public.rnx_customer_saved_listings
        set last_alert_price_type = new.price_type,
            last_alert_price = new.price,
            last_alert_currency = new.currency,
            last_alert_availability_status = new.availability_status
        where id = v_watch.saved_id;
      exception when others then
        -- Never block a supplier's legitimate catalogue update because the email
        -- outbox is temporarily unavailable. Leave the old baseline so a later material listing update can attempt the alert again.
        raise warning 'RNX saved-offer alert could not be queued for saved record %: %', v_watch.saved_id, sqlerrm;
      end;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.rnx_notify_saved_listing_changes() from public, anon, authenticated;
drop trigger if exists rnx_saved_listing_change_alert on public.rnx_listings;
create trigger rnx_saved_listing_change_alert
after update of price_type, price, currency, availability_status, status
on public.rnx_listings
for each row execute function public.rnx_notify_saved_listing_changes();

comment on function public.rnx_set_customer_listing_alert(uuid, uuid, boolean) is
  'Service-role-only customer opt-in/out for email alerts on a saved public listing; enabling captures the current listing values as the comparison baseline.';
comment on function public.rnx_notify_saved_listing_changes() is
  'Queues one email per opted-in, email-verified customer when a saved listing published price or supplier-reported availability changes.';
