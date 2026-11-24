import { NextRequest, NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { isSameOriginRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function activeCustomerId() {
  const customerId = await currentCustomerId();
  if (!customerId) return null;
  const { data, error } = await supabaseAdmin()
    .from('rnx_customers')
    .select('id')
    .eq('id', customerId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function GET() {
  try {
    const customerId = await activeCustomerId();
    if (!customerId) {
      return NextResponse.json({ error: 'Sign in to view your notifications.' }, { status: 401, headers: PRIVATE_HEADERS });
    }

    const db = supabaseAdmin();
    const [notificationsResult, unreadResult] = await Promise.all([
      db.from('rnx_customer_notifications')
        .select('id,notification_type,title,message,listing_id,listing_slug,listing_title,supplier_name,related_quote_id,read_at,created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(60),
      db.from('rnx_customer_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .is('read_at', null),
    ]);

    if (notificationsResult.error) throw notificationsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    return NextResponse.json({
      notifications: notificationsResult.data || [],
      unreadCount: unreadResult.count || 0,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer notifications] Could not load notifications:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your notifications could not be loaded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const customerId = await activeCustomerId();
    if (!customerId) {
      return NextResponse.json({ error: 'Sign in to update your notifications.' }, { status: 401, headers: PRIVATE_HEADERS });
    }

    const body = await request.json().catch(() => ({}));
    const notificationId = body?.notification_id;
    const markAllRead = body?.mark_all_read === true;
    if (!markAllRead && !(typeof notificationId === 'string' && UUID_PATTERN.test(notificationId))) {
      return NextResponse.json({ error: 'Choose a notification or request mark-all-read.' }, { status: 400, headers: PRIVATE_HEADERS });
    }
    if (markAllRead && notificationId !== undefined) {
      return NextResponse.json({ error: 'Choose either one notification or mark all as read.' }, { status: 400, headers: PRIVATE_HEADERS });
    }

    let query = supabaseAdmin()
      .from('rnx_customer_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .is('read_at', null);
    if (!markAllRead) query = query.eq('id', notificationId);

    const { data, error } = await query.select('id');
    if (error) throw error;
    return NextResponse.json({ ok: true, updatedCount: data?.length || 0 }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer notifications] Could not update read state:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your notification could not be updated.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
