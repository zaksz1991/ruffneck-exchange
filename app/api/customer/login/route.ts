import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyCustomerPassword, createCustomerSession, CUSTOMER_COOKIE, customerCookieOptions, customerAttemptKey, customerSessionConfigured } from '@/lib/customer-auth';

export const runtime = 'nodejs';
const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(100) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address and password.' }, { status: 400 });
  if (!customerSessionConfigured()) return NextResponse.json({ error: 'Customer sign-in is not configured. Set RNX_CUSTOMER_SESSION_SECRET or RNX_ADMIN_SESSION_SECRET in Vercel.' }, { status: 503 });
  try {
    const db = supabaseAdmin();
    const email = parsed.data.email.toLowerCase();
    const attemptKey = customerAttemptKey(email, request);
    const { data: locked, error: lockError } = await db.rpc('rnx_customer_auth_is_locked', { p_attempt_key: attemptKey });
    if (!lockError && locked === true) return NextResponse.json({ error: 'Too many failed sign-in attempts. Try again after the temporary security lock expires.' }, { status: 429 });
    const { data: customer, error } = await db.from('rnx_customers')
      .select('id,name,email,password_hash,status,email_verified_at')
      .eq('email', email).maybeSingle();
    if (error) throw error;
    if (!customer || customer.status !== 'active' || !verifyCustomerPassword(parsed.data.password, customer.password_hash)) {
      await db.rpc('rnx_customer_auth_register_failure', { p_attempt_key: attemptKey, p_max_attempts: 6, p_window_minutes: 15, p_lock_minutes: 30 });
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    await db.rpc('rnx_customer_auth_clear', { p_attempt_key: attemptKey });
    if (!customer.email_verified_at) {
      return NextResponse.json({
        error: 'Confirm your email address before signing in. Request a new verification link below.',
        emailVerificationRequired: true,
      }, { status: 403 });
    }
    const response = NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email } });
    response.cookies.set(CUSTOMER_COOKIE, createCustomerSession(customer.id), customerCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX customer] Login unavailable:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Customer sign-in is temporarily unavailable. Confirm migration 006 and the RNX email-verification migration.' }, { status: 503 });
  }
}
