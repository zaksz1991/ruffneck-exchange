import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const supplier = await getAuthenticatedSupplier();
  if (!supplier) {
    return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const body = await request.json().catch(() => null) as { notification_id?: unknown; mark_all_read?: unknown } | null;
  const notificationId = body?.notification_id;
  const markAllRead = body?.mark_all_read === true;
  if (!markAllRead && !(typeof notificationId === 'string' && UUID_PATTERN.test(notificationId))) {
    return NextResponse.json({ error: 'Choose a notification or request mark-all-read.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (markAllRead && notificationId !== undefined) {
    return NextResponse.json({ error: 'Choose either one notification or mark all as read.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    let query = supabaseAdmin()
      .from('rnx_supplier_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('supplier_application_id', supplier.id)
      .is('read_at', null);
    if (!markAllRead) query = query.eq('id', notificationId as string);

    const { data, error } = await query.select('id');
    if (error) throw error;
    return NextResponse.json({ ok: true, updatedCount: data?.length || 0 }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier notifications] Could not update read state:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your notification could not be updated.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
