import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { issueRnxEmailVerificationLink } from '@/lib/email-verification';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ accountType: z.enum(['customer', 'supplier']), email: z.string().trim().email().max(254) });
const genericMessage = 'If an eligible account uses that email address and still needs confirmation, a new verification link has been requested. Check the inbox and spam folder. RNX does not confirm whether an account exists.';
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: 'Request rejected.' }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Enter a valid account type and email address.' }, 400);
  try {
    const db = supabaseAdmin();
    const email = parsed.data.email.toLowerCase();
    if (parsed.data.accountType === 'customer') {
      const { data, error } = await db.from('rnx_customers')
        .select('id,email,email_verified_at,status')
        .eq('email', email).eq('status', 'active').maybeSingle();
      if (error) throw new Error('Customer verification lookup failed.');
      if (data && !data.email_verified_at) {
        await issueRnxEmailVerificationLink({ accountType: 'customer', accountId: data.id, email: data.email, request });
      }
    } else {
      const { data, error } = await db.from('rnx_supplier_applications')
        .select('id,email,email_verified_at,status')
        .eq('email', email).in('status', ['pending', 'approved']).maybeSingle();
      if (error) throw new Error('Supplier verification lookup failed.');
      if (data && !data.email_verified_at) {
        await issueRnxEmailVerificationLink({ accountType: 'supplier', accountId: data.id, email: data.email, request });
      }
    }
    return json({ ok: true, message: genericMessage });
  } catch (error) {
    console.error('[RNX email verification] Request unavailable:', error instanceof Error ? error.message : 'unknown error');
    // Keep the response generic even when storage or mail delivery is unavailable.
    return json({ ok: true, message: genericMessage });
  }
}
