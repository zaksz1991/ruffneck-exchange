import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { runNotificationBatch } from '@/lib/notification-worker';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'notifications:process')) return NextResponse.json({ error: 'You do not have permission to process notifications.' }, { status: 403 });
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim()) {
    return NextResponse.json({ error: 'Configure RESEND_API_KEY and RNX_NOTIFICATION_FROM_EMAIL before processing email.' }, { status: 409 });
  }
  try {
    const db = supabaseAdmin();
    const result = await runNotificationBatch(db, 10);
    await recordStaffActivity(db, actor, 'notification_queue_processed', undefined, undefined, { processed: result });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin notification process] Failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Notification processing failed.' }, { status: 503 });
  }
}
