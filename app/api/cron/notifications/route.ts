import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-server';
import { runNotificationBatch } from '@/lib/notification-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 50;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization') || '';
  if (!secret || secret.length < 24 || !supplied.startsWith('Bearer ')) return false;
  const token = supplied.slice(7);
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim()) {
    return NextResponse.json({ error: 'Email provider is not configured; no notifications were claimed.' }, { status: 503 });
  }
  try {
    const result = await runNotificationBatch(supabaseAdmin(), 10);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX notification cron] Worker failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Notification worker failed.' }, { status: 503 });
  }
}
