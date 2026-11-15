import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { issueRnxEmailVerificationLink } from '@/lib/email-verification';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashCustomerPassword, customerSessionConfigured } from '@/lib/customer-auth';

export const runtime = 'nodejs';
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(10).max(100),
});
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid name, email, phone number and a password of at least 10 characters.' }, { status: 400 });
  if (!customerSessionConfigured()) return NextResponse.json({ error: 'Customer sign-in is not configured. Set RNX_CUSTOMER_SESSION_SECRET or RNX_ADMIN_SESSION_SECRET in Vercel.' }, { status: 503 });
  try {
    const db = supabaseAdmin();
    const values = parsed.data;
    const email = values.email.toLowerCase();
    const { data: existing, error: lookupError } = await db.from('rnx_customers').select('id').eq('email', email).maybeSingle();
    if (lookupError) throw new Error('Customer lookup failed.');
    if (existing) return NextResponse.json({ error: 'An account with this email already exists. Sign in and request an email confirmation link if needed.' }, { status: 409 });
    const { data, error } = await db.from('rnx_customers').insert({
      name: values.name,
      email,
      phone: values.phone,
      password_hash: hashCustomerPassword(values.password),
      status: 'active',
      email_verified_at: null,
    }).select('id,name,email').single();
    if (error || !data) {
      console.error('[RNX customer] Registration failed:', error?.message);
      return NextResponse.json({ error: 'Account registration is temporarily unavailable.' }, { status: 503 });
    }
    let emailVerificationSent = false;
    try {
      const result = await issueRnxEmailVerificationLink({ accountType: 'customer', accountId: data.id, email, request });
      emailVerificationSent = result.sent;
    } catch (mailError) {
      console.error('[RNX customer] Verification email could not be issued:', mailError instanceof Error ? mailError.message : 'unknown error');
    }
    return NextResponse.json({
      ok: true,
      requiresEmailVerification: true,
      emailVerificationSent,
      message: emailVerificationSent
        ? 'Your account has been created. Open the verification link sent to your email before signing in.'
        : 'Your account has been created but the verification email was not sent. Use the resend option on the sign-in page or contact RNX Operations.',
    }, { status: 201 });
  } catch (error) {
    console.error('[RNX customer] Registration unavailable:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Account registration is temporarily unavailable. Confirm migration 006 and the current RNX email-verification migration.' }, { status: 503 });
  }
}
