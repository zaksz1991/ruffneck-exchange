-- RuffNeck Exchange v3.4.0: private supplier notifications for commercial quote decisions.
-- Requires migrations 001-024 in the existing RuffNeck Entertainment project.
-- No customer contact information is copied into supplier notifications.

create table if not exists public.rnx_supplier_notifications (
  id uuid primary key default gen_random_uuid(),
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'commercial_quote_selected',
    'commercial_quote_not_selected',
    'commercial_quote_declined',
    'commercial_quote_expired'
  )),
  title text not null check (char_length(trim(title)) between 2 and 160),
  message text not null check (char_length(trim(message)) between 2 and 600),
  related_quote_id uuid references public.rnx_commercial_quotes(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rnx_supplier_notifications_supplier_created_idx
  on public.rnx_supplier_notifications(supplier_application_id, created_at desc);

create index if not exists rnx_supplier_notifications_supplier_unread_idx
  on public.rnx_supplier_notifications(supplier_application_id, created_at desc)
  where read_at is null;

alter table public.rnx_supplier_notifications enable row level security;
revoke all on public.rnx_supplier_notifications from public, anon, authenticated;
grant select, insert, update on public.rnx_supplier_notifications to service_role;

comment on table public.rnx_supplier_notifications is
  'Private supplier-scoped in-app notifications for customer and system decisions on commercial quotations. Direct browser-role access is disabled; the authenticated RNX server API enforces supplier ownership.';

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

drop trigger if exists rnx_supplier_quote_status_notification on public.rnx_commercial_quotes;
create trigger rnx_supplier_quote_status_notification
  after update of status on public.rnx_commercial_quotes
  for each row
  execute function public.rnx_notify_supplier_commercial_quote_status();
