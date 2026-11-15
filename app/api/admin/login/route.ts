import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, isSameOriginRequest, verifyAdminPassword } from '@/lib/admin-auth';

export const runtime = 'nodejs';
const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter the administrator password.' }, { status: 400 });

  try {
    if (!verifyAdminPassword(parsed.data.password)) {
      return NextResponse.json({ error: 'Sign-in failed. Check the password and server configuration.' }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX admin] Login configuration error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Administrator access is not configured correctly.' }, { status: 503 });
  }
}
