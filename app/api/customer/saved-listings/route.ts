import { NextRequest, NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { signedListingImageUrl } from '@/lib/listing-image-storage';
import { isSameOriginRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };

function listingIdFrom(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to view saved offers.' }, { status: 401, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const requestedListingId = request.nextUrl.searchParams.get('listing_id');
    if (requestedListingId !== null) {
      const listingId = listingIdFrom(requestedListingId);
      if (!listingId) return NextResponse.json({ error: 'A valid listing reference is required.' }, { status: 400, headers: PRIVATE_HEADERS });
      const { data, error } = await db
        .from('rnx_customer_saved_listings')
        .select('id')
        .eq('customer_id', customerId)
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ saved: Boolean(data) }, { headers: PRIVATE_HEADERS });
    }

    const { data, error } = await db
      .from('rnx_customer_saved_listings')
      .select('id,listing_id,created_at,alerts_enabled,listing:rnx_listings!inner(id,slug,title,listing_type,category,state,city,price_type,price,currency,availability_status,image_path,supplier:rnx_supplier_applications!inner(public_slug,business_name,status))')
      .eq('customer_id', customerId)
      .eq('listing.status', 'approved')
      .eq('listing.supplier.status', 'approved')
      .not('listing.supplier.public_slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const savedListings = await Promise.all((data || []).map(async (row: any) => {
      const listing = row.listing;
      if (!listing) return null;
      const imageUrl = await signedListingImageUrl(db, listing.image_path);
      const { image_path: _imagePath, ...publicListing } = listing;
      return { ...publicListing, saved_id: row.id, saved_at: row.created_at, alerts_enabled: row.alerts_enabled === true, image_url: imageUrl };
    }));

    return NextResponse.json({ savedListings: savedListings.filter(Boolean) }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Saved listings could not be loaded:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Saved offers could not be loaded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to save an offer.' }, { status: 401, headers: PRIVATE_HEADERS });

  try {
    const body = await request.json().catch(() => ({}));
    const listingId = listingIdFrom(body?.listing_id);
    if (!listingId) return NextResponse.json({ error: 'A valid listing reference is required.' }, { status: 400, headers: PRIVATE_HEADERS });

    const db = supabaseAdmin();
    const { data: listing, error: listingError } = await db
      .from('rnx_listings')
      .select('id,supplier:rnx_supplier_applications!inner(status,public_slug)')
      .eq('id', listingId)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null)
      .maybeSingle();
    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: 'This offer is no longer available to save.' }, { status: 404, headers: PRIVATE_HEADERS });

    const { error } = await db.from('rnx_customer_saved_listings').insert({ customer_id: customerId, listing_id: listingId });
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ ok: true, saved: true }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Save listing failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'This offer could not be saved.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}


export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  }
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to manage saved-offer alerts.' }, { status: 401, headers: PRIVATE_HEADERS });

  try {
    const body = await request.json().catch(() => ({}));
    const listingId = listingIdFrom(body?.listing_id);
    if (!listingId || typeof body?.alerts_enabled !== 'boolean') {
      return NextResponse.json({ error: 'A valid saved offer and alert preference are required.' }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const { data, error } = await supabaseAdmin().rpc('rnx_set_customer_listing_alert', {
      p_customer_id: customerId,
      p_listing_id: listingId,
      p_enabled: body.alerts_enabled,
    });
    if (error) throw error;
    if (data !== true) {
      return NextResponse.json({ error: 'This offer is no longer public or is not in your saved offers.' }, { status: 409, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ ok: true, alerts_enabled: body.alerts_enabled }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Saved-offer alert preference failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your saved-offer alert preference could not be updated.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to manage saved offers.' }, { status: 401, headers: PRIVATE_HEADERS });

  try {
    const body = await request.json().catch(() => ({}));
    const listingId = listingIdFrom(body?.listing_id);
    if (!listingId) return NextResponse.json({ error: 'A valid listing reference is required.' }, { status: 400, headers: PRIVATE_HEADERS });

    const { error } = await supabaseAdmin()
      .from('rnx_customer_saved_listings')
      .delete()
      .eq('customer_id', customerId)
      .eq('listing_id', listingId);
    if (error) throw error;
    return NextResponse.json({ ok: true, saved: false }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Remove saved listing failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'This offer could not be removed.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
