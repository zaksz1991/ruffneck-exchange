import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { createSupplierSession, supplierCookieOptions, verifySupplierPassword, SUPPLIER_COOKIE } from '@/lib/supplier-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(100) });

function attemptKey(email: string, request: Request): string {
  const secret = process.env.RNX_SUPPLIER_SESSION_SECRET?.trim() || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('Supplier session secret is not configured.');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', secret).update(`${email.toLowerCase()}|${forwarded}`).digest('hex');
}

const dummyHash = 'scrypt$00000000000000000000000000000000$'.concat('0'.repeat(128));

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid business email and password.' }, { status: 400 });

  try {
    const email = parsed.data.email.toLowerCase();
    const key = attemptKey(email, request);
    const db = supabaseAdmin();
    const { data: locked, error: lockError } = await db.rpc('rnx_supplier_auth_is_locked', { p_attempt_key: key });
    if (lockError) throw new Error('Supplier login protection is not available. Confirm migration 005 is applied.');
    if (locked === true) return NextResponse.json({ error: 'Too many sign-in attempts. Wait 30 minutes before trying again.' }, { status: 429 });

    const { data: supplier, error } = await db.from('rnx_supplier_applications')
      .select('id,status,portal_enabled,portal_password_hash')
      .eq('email', email).eq('status', 'approved').limit(1).maybeSingle();
    if (error) throw new Error('Supplier account lookup failed.');
    const passwordMatches = verifySupplierPassword(parsed.data.password, supplier?.portal_password_hash ?? dummyHash);
    if (!supplier || supplier.status !== 'approved' || supplier.portal_enabled !== true || !passwordMatches) {
      await db.rpc('rnx_supplier_auth_register_failure', { p_attempt_key: key, p_max_attempts: 6, p_window_minutes: 15, p_lock_minutes: 30 });
      return NextResponse.json({ error: 'Sign-in failed. Check your details and confirm that your business has been approved and portal access is enabled.' }, { status: 401 });
    }
    await db.rpc('rnx_supplier_auth_clear', { p_attempt_key: key });
    const response = NextResponse.json({ ok: true, redirectTo: '/supplier/dashboard' });
    response.cookies.set(SUPPLIER_COOKIE, createSupplierSession(supplier.id), supplierCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX supplier login]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Supplier sign-in is temporarily unavailable. Confirm the portal migration and server environment variables.' }, { status: 503 });
  }
}
