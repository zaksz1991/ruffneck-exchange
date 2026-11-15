import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { ANALYTICS_CONSENT_COOKIE, analyticsConsentCookieOptions } from '@/lib/analytics-consent';

export const runtime = 'nodejs';
const schema = z.object({ decision: z.enum(['accepted', 'rejected']) });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Choose whether to allow optional analytics.' }, { status: 400 });
  const response = NextResponse.json({ ok: true, decision: parsed.data.decision }, { headers: { 'Cache-Control': 'no-store, private' } });
  response.cookies.set(ANALYTICS_CONSENT_COOKIE, parsed.data.decision === 'accepted' ? 'granted' : 'denied', analyticsConsentCookieOptions());
  return response;
}
