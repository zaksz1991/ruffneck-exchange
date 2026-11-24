import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentCustomerId } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ outcome: z.enum(['completed', 'not_completed']) });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to confirm this transaction.' }, { status: 401 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid introduction reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose whether the transaction was completed.' }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin().rpc('rnx_confirm_transaction_outcome', {
      p_offer_id: id,
      p_actor_role: 'customer',
      p_actor_id: customerId,
      p_outcome: parsed.data.outcome,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; status?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Transaction confirmation was rejected.' }, { status: 409 });
    return NextResponse.json({ ok: true, status: result.status, message: result.status === 'completed' ? 'Both parties confirmed completion. You can now leave a verified review.' : result.status === 'disputed' ? 'Your confirmation differs from the supplier response. RNX will need to review the discrepancy.' : 'Your transaction outcome has been recorded.' }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX customer] Transaction confirmation failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Transaction confirmation is temporarily unavailable. Confirm migration 023 is applied.' }, { status: 503 });
  }
}
