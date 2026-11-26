-- RuffNeck Exchange v2.4.0: supplier-reported listing availability.
-- Additive only. Run after RNX migrations 001–016 in the existing RNX Supabase project.
-- Availability is operational seller-provided information, not a stock audit or guarantee.

alter table public.rnx_listings
  add column if not exists availability_status text not null default 'unconfirmed',
  add column if not exists availability_note text,
  add column if not exists availability_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rnx_listings_availability_status_check'
      and conrelid = 'public.rnx_listings'::regclass
  ) then
    alter table public.rnx_listings
      add constraint rnx_listings_availability_status_check
      check (availability_status in ('unconfirmed','available','limited','on_request','out_of_stock'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'rnx_listings_availability_note_length_check'
      and conrelid = 'public.rnx_listings'::regclass
  ) then
    alter table public.rnx_listings
      add constraint rnx_listings_availability_note_length_check
      check (availability_note is null or char_length(availability_note) <= 240);
  end if;
end;
$$;

create index if not exists rnx_listings_public_availability_idx
  on public.rnx_listings(availability_status, status, created_at desc);

comment on column public.rnx_listings.availability_status is
  'Supplier-reported listing availability. It is not independently verified by RNX.';
comment on column public.rnx_listings.availability_note is
  'Optional supplier-provided availability clarification, maximum 240 characters.';
comment on column public.rnx_listings.availability_updated_at is
  'Timestamp of the latest supplier availability update; NULL means the supplier has not updated it.';
