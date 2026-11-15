import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ action: z.enum(['pause', 'reactivate']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid listing action.' }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  try {
    const db = supabaseAdmin();
    const { data: listing, error: lookupError } = await db.from('rnx_listings')
      .select('id,status').eq('id', id).eq('supplier_application_id', supplier.id).maybeSingle();
    if (lookupError) throw new Error('Listing lookup failed.');
    if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    const nextStatus = parsed.data.action === 'pause' ? 'paused' : 'pending';
    const allowed = parsed.data.action === 'pause' ? listing.status === 'approved' : listing.status === 'paused';
    if (!allowed) return NextResponse.json({ error: parsed.data.action === 'pause'
      ? 'Only a currently approved listing can be paused.'
      : 'Only a paused listing can be submitted for re-review.' }, { status: 409 });

    const { error } = await db.from('rnx_listings').update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id).eq('supplier_application_id', supplier.id).eq('status', listing.status);
    if (error) throw new Error('Listing status update failed.');
    return NextResponse.json({ ok: true, status: nextStatus, message: nextStatus === 'paused'
      ? 'Listing paused and removed from public marketplace results.'
      : 'Listing submitted for review. It will remain hidden until RNX approves it again.' });
  } catch (error) {
    console.error('[RNX supplier listing status]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Listing status could not be updated. Try again later.' }, { status: 503 });
  }
}
