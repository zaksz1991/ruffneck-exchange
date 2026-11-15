import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession, ADMIN_COOKIE, adminCookieOptions, isSameOriginRequest } from '@/lib/admin-auth';
import { hashOpaqueToken, hashStaffPassword } from '@/lib/staff-credentials';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';
import type { StaffRole } from '@/lib/admin-auth';

export const runtime = 'nodejs';
const schema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Use a valid invitation, full name and password of at least 12 characters containing upper-case, lower-case and numeric characters.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('rnx_accept_staff_invitation', {
      p_token_hash: hashOpaqueToken(parsed.data.token),
      p_password_hash: hashStaffPassword(parsed.data.password),
      p_full_name: parsed.data.fullName,
    });
    if (error) {
      console.error('[RNX staff invitation acceptance]', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Staff invitation acceptance is unavailable. Confirm migration 009 is applied.' }, { status: 503 });
    }
    const result = data as { ok?: boolean; error?: string; staff_id?: string; email?: string; role?: string };
    if (!result?.ok || !result.staff_id) {
      const message = result?.error === 'account_exists' ? 'A staff account already exists for this invitation email.' : 'This invitation is invalid, expired, revoked or already used.';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (result.email && result.role && ['owner','operations_admin','finance','support','analyst'].includes(result.role)) {
      await recordStaffActivity(db, { id: result.staff_id, email: result.email, fullName: parsed.data.fullName, role: result.role as StaffRole, isBootstrap: false }, 'staff_account_activated');
    }
    const redirectTo = result.role === 'support' ? '/admin/communications' : result.role === 'finance' ? '/admin/memberships' : result.role === 'analyst' ? '/admin/analytics' : '/admin';
    const response = NextResponse.json({ ok: true, redirectTo }, { headers: { 'Cache-Control': 'no-store, private' } });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(result.staff_id), adminCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX staff invitation acceptance] Failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The invitation could not be accepted.' }, { status: 503 });
  }
}
