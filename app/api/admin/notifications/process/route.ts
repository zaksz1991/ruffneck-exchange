import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isSameOriginRequest, isValidAdminSession } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { runNotificationBatch } from '@/lib/notification-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const jar = await cookies();
  if (!isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim()) {
    return NextResponse.json({ error: 'Configure RESEND_API_KEY and RNX_NOTIFICATION_FROM_EMAIL before processing email.' }, { status: 409 });
  }
  try {
    const result = await runNotificationBatch(supabaseAdmin(), 10);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin notification process] Failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Notification processing failed.' }, { status: 503 });
  }
}
