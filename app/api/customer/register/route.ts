import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashCustomerPassword, createCustomerSession, CUSTOMER_COOKIE, customerCookieOptions, customerSessionConfigured } from '@/lib/customer-auth';

export const runtime = 'nodejs';
const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().min(7).max(30), password: z.string().min(10).max(100) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid name, email, phone number and a password of at least 10 characters.' }, { status: 400 });
  if (!customerSessionConfigured()) return NextResponse.json({ error: 'Customer sign-in is not configured. Set RNX_CUSTOMER_SESSION_SECRET or RNX_ADMIN_SESSION_SECRET in Vercel.' }, { status: 503 });
  try {
    const db = supabaseAdmin(); const values = parsed.data; const email = values.email.toLowerCase();
    const { data: existing } = await db.from('rnx_customers').select('id').eq('email', email).maybeSingle();
    if (existing) return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
    const { data, error } = await db.from('rnx_customers').insert({ name: values.name, email, phone: values.phone, password_hash: hashCustomerPassword(values.password), status: 'active' }).select('id,name,email').single();
    if (error || !data) { console.error('[RNX customer] Registration failed:', error?.message); return NextResponse.json({ error: 'Account registration is temporarily unavailable.' }, { status: 503 }); }
    const response = NextResponse.json({ ok: true, customer: data }, { status: 201 });
    response.cookies.set(CUSTOMER_COOKIE, createCustomerSession(data.id), customerCookieOptions());
    return response;
  } catch (error) {
    console.error('[RNX customer] Registration unavailable:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Account registration is temporarily unavailable. Confirm migration 006 and server credentials.' }, { status: 503 });
  }
}
