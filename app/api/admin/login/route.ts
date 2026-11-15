import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, isSameOriginRequest, verifyAdminPassword } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyStaffPassword } from '@/lib/staff-credentials';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
const schema = z.object({
  email: z.string().trim().max(254).optional().or(z.literal('')),
  password: z.string().min(1).max(200),
});
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter valid sign-in details.' }, { status: 400 });

  try {
    const email = (parsed.data.email || '').trim().toLowerCase();
    if (email) {
      if (!z.string().email().safeParse(email).success) return NextResponse.json({ error: 'Sign-in failed. Check the email and password.' }, { status: 401 });
      const db = supabaseAdmin();
      const { data: staff, error } = await db.from('rnx_staff_users')
        .select('id,email,full_name,role,status,password_hash')
        .eq('email', email).maybeSingle();
      if (error) {
        console.error('[RNX staff login] Lookup failed:', { code: error.code, message: error.message });
        return NextResponse.json({ error: 'Staff sign-in is not available. Confirm migration 009 is applied.' }, { status: 503 });
      }
      const validPassword = verifyStaffPassword(parsed.data.password, staff?.password_hash || DUMMY_HASH);
      if (!staff || staff.status !== 'active' || !validPassword) {
        return NextResponse.json({ error: 'Sign-in failed. Check the email and password, or contact the RNX owner.' }, { status: 401 });
      }
      await db.from('rnx_staff_users').update({ last_login_at: new Date().toISOString() }).eq('id', staff.id);
      const actor = { id: staff.id, email: staff.email, fullName: staff.full_name, role: staff.role, isBootstrap: false } as const;
      await recordStaffActivity(db, actor, 'staff_login');
      const response = NextResponse.json({ ok: true, redirectTo: staff.role === 'support' ? '/admin/communications' : staff.role === 'finance' ? '/admin/memberships' : staff.role === 'analyst' ? '/admin/analytics' : '/admin' });
      response.cookies.set(ADMIN_COOKIE, createAdminSession(staff.id), adminCookieOptions());
      return response;
    }

    if (!verifyAdminPassword(parsed.data.password)) {
      return NextResponse.json({ error: 'Sign-in failed. Check the password and server configuration.' }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true, redirectTo: '/admin' });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(null), adminCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX admin] Login configuration error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Administrator access is not configured correctly.' }, { status: 503 });
  }
}
