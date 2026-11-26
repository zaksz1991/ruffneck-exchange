-- RuffNeck Exchange v2.3.0: additional supplier listing gallery photos.
-- ADDITIVE ONLY. Depends on RNX migrations 001–015.
-- The existing rnx_listings.image_path remains the cover photo; this table stores
-- up to four additional photos per listing in the existing private Storage bucket.

create table if not exists public.rnx_listing_gallery_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rnx_listings(id) on delete cascade,
  supplier_application_id uuid not null references public.rnx_supplier_applications(id) on delete cascade,
  image_path text not null unique,
  sort_order integer not null default 1 check (sort_order between 1 and 4),
  created_at timestamptz not null default now()
);

create index if not exists rnx_listing_gallery_listing_order_idx
  on public.rnx_listing_gallery_images(listing_id, sort_order, created_at);

create index if not exists rnx_listing_gallery_supplier_idx
  on public.rnx_listing_gallery_images(supplier_application_id, created_at desc);

comment on table public.rnx_listing_gallery_images is
  'Private additional listing photographs. The primary cover remains in rnx_listings.image_path. Public listing pages receive short-lived signed URLs only after the listing and supplier are approved.';

alter table public.rnx_listing_gallery_images enable row level security;
revoke all on public.rnx_listing_gallery_images from anon, authenticated;

-- Enforce supplier ownership, editable moderation state and the four-photo cap
-- inside the database as well as in the API. Locking the parent listing row
-- serialises concurrent uploads so parallel requests cannot exceed the limit.
create or replace function public.rnx_validate_listing_gallery_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_status text;
  v_existing_count integer;
begin
  select supplier_application_id, status
    into v_supplier_id, v_status
    from public.rnx_listings
    where id = new.listing_id
    for update;

  if not found or v_supplier_id <> new.supplier_application_id then
    raise exception 'Listing gallery ownership check failed.' using errcode = '23514';
  end if;

  if v_status not in ('pending', 'rejected', 'paused') then
    raise exception 'Listing must be pending, rejected or paused before gallery changes.' using errcode = '23514';
  end if;

  select count(*) into v_existing_count
    from public.rnx_listing_gallery_images
    where listing_id = new.listing_id;

  if v_existing_count >= 4 then
    raise exception 'Listing gallery limit of four additional photos reached.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.rnx_validate_listing_gallery_insert() from public, anon, authenticated;

drop trigger if exists rnx_listing_gallery_validate_insert on public.rnx_listing_gallery_images;
create trigger rnx_listing_gallery_validate_insert
  before insert on public.rnx_listing_gallery_images
  for each row execute function public.rnx_validate_listing_gallery_insert();

create or replace function public.rnx_validate_listing_gallery_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_status text;
begin
  select supplier_application_id, status
    into v_supplier_id, v_status
    from public.rnx_listings
    where id = old.listing_id
    for update;

  -- Allow parent-listing cascades after the parent row has been removed.
  if not found then
    return old;
  end if;

  if v_supplier_id <> old.supplier_application_id then
    raise exception 'Listing gallery ownership check failed.' using errcode = '23514';
  end if;

  if v_status not in ('pending', 'rejected', 'paused') then
    raise exception 'Listing must be pending, rejected or paused before gallery changes.' using errcode = '23514';
  end if;

  return old;
end;
$$;

revoke all on function public.rnx_validate_listing_gallery_delete() from public, anon, authenticated;

drop trigger if exists rnx_listing_gallery_validate_delete on public.rnx_listing_gallery_images;
create trigger rnx_listing_gallery_validate_delete
  before delete on public.rnx_listing_gallery_images
  for each row execute function public.rnx_validate_listing_gallery_delete();
