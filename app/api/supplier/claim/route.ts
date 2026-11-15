import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { createSupplierSession, hashSupplierPassword, supplierCookieOptions, SUPPLIER_COOKIE } from '@/lib/supplier-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'This supplier access link is invalid or has expired.'), password: z.string().min(10).max(100), confirmPassword: z.string().min(10).max(100) }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the password fields.' }, { status: 400 });
  try {
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const db = supabaseAdmin();
    const { data: supplier, error } = await db.from('rnx_supplier_applications')
      .select('id,status,portal_invite_expires_at')
      .eq('portal_invite_token_hash', tokenHash)
      .eq('status', 'approved')
      .gt('portal_invite_expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !supplier) return NextResponse.json({ error: 'This supplier access link is invalid or has expired. Request a new link from RNX operations.' }, { status: 400 });
    // Consume the invitation using its hash and expiry in the UPDATE predicate.
    // Concurrent claims cannot both succeed because only the first UPDATE can match.
    const { data: claimed, error: updateError } = await db.from('rnx_supplier_applications').update({
      portal_password_hash: hashSupplierPassword(parsed.data.password),
      portal_enabled: true,
      portal_invite_token_hash: null,
      portal_invite_expires_at: null,
    }).eq('id', supplier.id)
      .eq('portal_invite_token_hash', tokenHash)
      .gt('portal_invite_expires_at', new Date().toISOString())
      .select('id').maybeSingle();
    if (updateError) return NextResponse.json({ error: 'The supplier portal account could not be activated.' }, { status: 503 });
    if (!claimed) return NextResponse.json({ error: 'This supplier access link has already been used or has expired. Request a new link from RNX operations.' }, { status: 409 });
    const response = NextResponse.json({ ok: true, redirectTo: '/supplier/dashboard' });
    response.cookies.set(SUPPLIER_COOKIE, createSupplierSession(supplier.id), supplierCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX supplier claim]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Supplier account setup is temporarily unavailable.' }, { status: 503 });
  }
}
