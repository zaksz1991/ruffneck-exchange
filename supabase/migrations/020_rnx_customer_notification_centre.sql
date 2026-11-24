-- RuffNeck Exchange v2.8.0: private in-app customer notification centre.
-- Additive RNX-only migration. Apply after migrations 001-019 in RuffNeck Entertainment.
-- Notifications are created for active customers who saved a public offer; email alerts
-- remain separately controlled by the explicit alerts_enabled preference from migration 019.

alter table public.rnx_customer_saved_listings
  add column if not exists last_seen_price_type text,
  add column if not exists last_seen_price numeric(14,2),
  add column if not exists last_seen_currency text,
  add column if not exists last_seen_availability_status text;

comment on column public.rnx_customer_saved_listings.last_seen_price_type is
  'Last published price type observed for in-app saved-offer change notifications.';
comment on column public.rnx_customer_saved_listings.last_seen_price is
  'Last published price observed for in-app saved-offer change notifications.';
comment on column public.rnx_customer_saved_listings.last_seen_currency is
  'Last published currency observed for in-app saved-offer change notifications.';
comment on column public.rnx_customer_saved_listings.last_seen_availability_status is
  'Last supplier-reported availability observed for in-app saved-offer change notifications.';

create table if not exists public.rnx_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.rnx_customers(id) on delete cascade,
  notification_type text not null default 'saved_listing_changed'
    check (notification_type in ('saved_listing_changed')),
  title text not null check (char_length(title) between 1 and 200),
  message text not null check (char_length(message) between 1 and 1600),
  listing_id uuid references public.rnx_listings(id) on delete set null,
  listing_slug text,
  listing_title text,
  supplier_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rnx_customer_notifications_customer_created_idx
  on public.rnx_customer_notifications(customer_id, created_at desc);
create index if not exists rnx_customer_notifications_customer_unread_idx
  on public.rnx_customer_notifications(customer_id, created_at desc)
  where read_at is null;

alter table public.rnx_customer_notifications enable row level security;
revoke all on public.rnx_customer_notifications from public, anon, authenticated;

comment on table public.rnx_customer_notifications is
  'Private in-app notifications for signed-in RuffNeck Exchange customers.';

-- Initialise existing saved offers at the currently published values so migration 020
-- does not produce a burst of historical notifications on the next supplier update.
update public.rnx_customer_saved_listings as saved
set last_seen_price_type = coalesce(saved.last_seen_price_type, listing.price_type),
    last_seen_price = coalesce(saved.last_seen_price, listing.price),
    last_seen_currency = coalesce(saved.last_seen_currency, listing.currency),
    last_seen_availability_status = coalesce(saved.last_seen_availability_status, listing.availability_status)
from public.rnx_listings as listing
where listing.id = saved.listing_id
  and (
    saved.last_seen_price_type is null
    or saved.last_seen_currency is null
    or saved.last_seen_availability_status is null
  );

-- New bookmarks start with the listing's current published values as their baseline.
-- Keep the existing publication guard while adding the baseline capture to the same trigger.
create or replace function public.rnx_guard_customer_saved_listing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing record;
begin
  select listing.price_type, listing.price, listing.currency, listing.availability_status
    into v_listing
  from public.rnx_listings as listing
  join public.rnx_supplier_applications as supplier on supplier.id = listing.supplier_application_id
  where listing.id = new.listing_id
    and listing.status = 'approved'
    and supplier.status = 'approved'
    and supplier.public_slug is not null;

  if not found then
    raise exception 'Only currently published RNX listings can be saved.';
  end if;

  new.last_seen_price_type := v_listing.price_type;
  new.last_seen_price := v_listing.price;
  new.last_seen_currency := v_listing.currency;
  new.last_seen_availability_status := v_listing.availability_status;
  return new;
end;
$$;

revoke all on function public.rnx_guard_customer_saved_listing() from public, anon, authenticated;
drop trigger if exists rnx_customer_saved_listing_publication_guard on public.rnx_customer_saved_listings;
create trigger rnx_customer_saved_listing_publication_guard
before insert or update of listing_id on public.rnx_customer_saved_listings
for each row execute function public.rnx_guard_customer_saved_listing();

-- Keep the v2.7.0 email preference and email outbox behaviour, while independently
-- recording a private in-app notification for every active customer who saved the offer.
create or replace function public.rnx_notify_saved_listing_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_watch record;
  v_in_app_changes text;
  v_email_changes text;
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

  -- Supplier edits can be held in moderation. Compare against the saved baseline
  -- when the listing becomes public again, not while it is hidden from customers.
  if row(new.price_type, new.price, new.currency, new.availability_status)
       is not distinct from row(old.price_type, old.price, old.currency, old.availability_status)
     and not v_republished then
    return new;
  end if;

  for v_watch in
    select
      saved.id as saved_id,
      saved.customer_id,
      saved.alerts_enabled,
      saved.last_seen_price_type,
      saved.last_seen_price,
      saved.last_seen_currency,
      saved.last_seen_availability_status,
      saved.last_alert_price_type,
      saved.last_alert_price,
      saved.last_alert_currency,
      saved.last_alert_availability_status,
      customer.name as customer_name,
      customer.email as customer_email,
      customer.email_verified_at,
      supplier.business_name
    from public.rnx_customer_saved_listings as saved
    join public.rnx_customers as customer on customer.id = saved.customer_id
    join public.rnx_supplier_applications as supplier on supplier.id = new.supplier_application_id
    where saved.listing_id = new.id
      and customer.status = 'active'
      and supplier.status = 'approved'
      and supplier.public_slug is not null
    order by saved.created_at asc
    for update of saved
  loop
    -- In-app notifications do not require email consent or an email address.
    v_in_app_changes := '';

    if v_watch.last_seen_price_type is distinct from new.price_type
       or v_watch.last_seen_price is distinct from new.price
       or v_watch.last_seen_currency is distinct from new.currency then
      v_old_price := case
        when v_watch.last_seen_price_type = 'enquiry' or v_watch.last_seen_price is null then 'Price on request'
        else coalesce(v_watch.last_seen_currency, 'NGN') || ' ' || v_watch.last_seen_price::text
      end;
      v_new_price := case
        when new.price_type = 'enquiry' or new.price is null then 'Price on request'
        else coalesce(new.currency, 'NGN') || ' ' || new.price::text
      end;
      v_in_app_changes := v_in_app_changes || 'Price changed from ' || v_old_price || ' to ' || v_new_price || '.';
    end if;

    if v_watch.last_seen_availability_status is distinct from new.availability_status then
      v_old_availability := case v_watch.last_seen_availability_status
        when 'available' then 'Available'
        when 'limited' then 'Limited availability'
        when 'on_request' then 'Confirm on request'
        when 'out_of_stock' then 'Currently unavailable'
        when 'unconfirmed' then 'Not confirmed'
        else coalesce(initcap(replace(v_watch.last_seen_availability_status, '_', ' ')), 'Not confirmed')
      end;
      v_new_availability := case new.availability_status
        when 'available' then 'Available'
        when 'limited' then 'Limited availability'
        when 'on_request' then 'Confirm on request'
        when 'out_of_stock' then 'Currently unavailable'
        when 'unconfirmed' then 'Not confirmed'
        else coalesce(initcap(replace(new.availability_status, '_', ' ')), 'Not confirmed')
      end;
      if v_in_app_changes <> '' then v_in_app_changes := v_in_app_changes || E'\n'; end if;
      v_in_app_changes := v_in_app_changes || 'Supplier-reported availability changed from ' || v_old_availability || ' to ' || v_new_availability || '.';
    end if;

    if v_in_app_changes <> '' then
      begin
        insert into public.rnx_customer_notifications (
          customer_id, notification_type, title, message, listing_id,
          listing_slug, listing_title, supplier_name
        ) values (
          v_watch.customer_id,
          'saved_listing_changed',
          'Saved offer update: ' || left(new.title, 175),
          v_in_app_changes,
          new.id,
          new.slug,
          new.title,
          v_watch.business_name
        );

        update public.rnx_customer_saved_listings
        set last_seen_price_type = new.price_type,
            last_seen_price = new.price,
            last_seen_currency = new.currency,
            last_seen_availability_status = new.availability_status
        where id = v_watch.saved_id;
      exception when others then
        -- A notification storage problem must never block a supplier catalogue update.
        raise warning 'RNX customer in-app notification could not be saved for record %: %', v_watch.saved_id, sqlerrm;
      end;
    end if;

    -- Email continues to require the customer's separate per-offer opt-in and a verified email.
    if v_watch.alerts_enabled = true and v_watch.email_verified_at is not null then
      v_email_changes := '';

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
        v_email_changes := v_email_changes || 'Price changed from ' || v_old_price || ' to ' || v_new_price || '.';
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
        if v_email_changes <> '' then v_email_changes := v_email_changes || E'\n'; end if;
        v_email_changes := v_email_changes || 'Supplier-reported availability changed from ' || v_old_availability || ' to ' || v_new_availability || '.';
      end if;

      if v_email_changes <> '' then
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
              v_email_changes
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
          -- Keep the old email baseline so a later material update can retry the alert.
          raise warning 'RNX saved-offer email alert could not be queued for record %: %', v_watch.saved_id, sqlerrm;
        end;
      end if;
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

comment on function public.rnx_notify_saved_listing_changes() is
  'Creates private in-app saved-offer notifications for active customers and separately queues email only for customers with verified email and explicit saved-offer email opt-in.';
