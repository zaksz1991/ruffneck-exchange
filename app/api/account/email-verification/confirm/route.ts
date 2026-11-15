import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  accountType: z.enum(['customer', 'supplier']),
  token: z.string().regex(/^[a-f0-9]{64}$/i),
});
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: 'Request rejected.' }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'The verification link is invalid or incomplete.' }, 400);
  try {
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const { data, error } = await supabaseAdmin().rpc('rnx_consume_email_verification_token', {
      p_token_hash: tokenHash,
      p_account_type: parsed.data.accountType,
    });
    if (error) {
      console.error('[RNX email verification] Confirmation failed:', error.message);
      return json({ error: 'Email confirmation is temporarily unavailable. Request a new link or contact RNX Operations.' }, 503);
    }
    if (data !== true) return json({ error: 'This verification link is invalid, expired or already used. Request a new link.' }, 400);
    return json({ ok: true, message: 'Your email address is confirmed. You can now sign in or continue with your supplier application.' });
  } catch (error) {
    console.error('[RNX email verification] Confirmation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Email confirmation is temporarily unavailable. Request a new link or contact RNX Operations.' }, 503);
  }
}
