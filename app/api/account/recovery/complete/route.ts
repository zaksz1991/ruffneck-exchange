import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { hashCustomerPassword, CUSTOMER_COOKIE } from '@/lib/customer-auth';
import { hashSupplierPassword, SUPPLIER_COOKIE } from '@/lib/supplier-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  accountType: z.enum(['customer', 'supplier']),
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'The reset link is invalid or incomplete.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(100),
});

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: 'Request rejected.' }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Enter a valid reset link and a password of at least 10 characters.' }, 400);

  try {
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const passwordHash = parsed.data.accountType === 'customer'
      ? hashCustomerPassword(parsed.data.password)
      : hashSupplierPassword(parsed.data.password);
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('rnx_consume_account_recovery_token', {
      p_token_hash: tokenHash,
      p_account_type: parsed.data.accountType,
      p_password_hash: passwordHash,
    });
    if (error) {
      console.error('[RNX recovery] Token completion failed:', error.message);
      return json({ error: 'The password could not be changed. Request a new reset link or contact RNX Operations.' }, 503);
    }
    if (data !== true) return json({ error: 'This reset link is invalid, expired or already used. Request a new link.' }, 400);

    const response = json({ ok: true, accountType: parsed.data.accountType, message: 'Your password has been changed. Sign in using your new password.' });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 };
    response.cookies.set(parsed.data.accountType === 'customer' ? CUSTOMER_COOKIE : SUPPLIER_COOKIE, '', cookieOptions);
    return response;
  } catch (error) {
    console.error('[RNX recovery] Password update failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'The password could not be changed. Request a new reset link or contact RNX Operations.' }, 503);
  }
}
