import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAnalyticsConsent } from '@/lib/analytics-consent';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ listing_id: z.string().uuid() });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  }

  const analyticsAllowed = await hasAnalyticsConsent();
  if (!analyticsAllowed) {
    return NextResponse.json({ ok: true, recorded: false }, { status: 202, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } });
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'The listing reference is invalid.' }, { status: 400 });
  }

  try {
    const db = supabaseAdmin();
    const { data: listing, error: listingError } = await db
      .from('rnx_listings')
      .select('id,supplier_application_id,supplier:rnx_supplier_applications!inner(id,status,public_slug)')
      .eq('id', parsed.data.listing_id)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ ok: true, recorded: false }, { status: 202, headers: { 'Cache-Control': 'no-store, private' } });
    }

    const { error: insertError } = await db.from('rnx_listing_view_events').insert({
      listing_id: listing.id,
      supplier_application_id: listing.supplier_application_id,
    });

    if (insertError) {
      // Analytics is optional and must never make a public listing unavailable.
      console.error('[RNX listing analytics] View event was not recorded:', insertError.message);
      return NextResponse.json({ ok: true, recorded: false }, { status: 202, headers: { 'Cache-Control': 'no-store, private' } });
    }

    return NextResponse.json({ ok: true, recorded: true }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX listing analytics] Event capture failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: true, recorded: false }, { status: 202, headers: { 'Cache-Control': 'no-store, private' } });
  }
}
