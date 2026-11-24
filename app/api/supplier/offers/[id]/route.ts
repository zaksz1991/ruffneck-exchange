import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  action: z.enum(['accept', 'decline', 'confirm_completed', 'confirm_not_completed']),
  note: z.string().trim().max(500).optional(),
});
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid opportunity.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid opportunity action.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    if (parsed.data.action === 'confirm_completed' || parsed.data.action === 'confirm_not_completed') {
      const { data, error } = await db.rpc('rnx_confirm_transaction_outcome', {
        p_offer_id: id,
        p_actor_role: 'supplier',
        p_actor_id: supplier.id,
        p_outcome: parsed.data.action === 'confirm_completed' ? 'completed' : 'not_completed',
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string; status?: string };
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Transaction confirmation was rejected.' }, { status: 409 });
      return NextResponse.json({ ok: true, status: result.status, message: result.status === 'completed' ? 'Both parties confirmed completion. The customer can now leave a verified review.' : result.status === 'disputed' ? 'Your confirmation differs from the customer response. RNX will need to review the discrepancy.' : 'Your transaction outcome has been recorded.' }, { headers: { 'Cache-Control': 'no-store, private' } });
    }

    const { data, error } = await db.rpc('rnx_supplier_respond_to_offer', {
      p_offer_id: id,
      p_supplier_id: supplier.id,
      p_decision: parsed.data.action,
      p_note: parsed.data.note || null,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; decision?: string; already_recorded?: boolean };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Offer response was rejected.' }, { status: 409 });
    return NextResponse.json({ ok: true, message: result.already_recorded ? `Your ${parsed.data.action} response was already recorded.` : `Opportunity ${result.decision}.` }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier offer response]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Opportunity response is temporarily unavailable. Confirm the cumulative RNX migrations are applied.' }, { status: 503 });
  }
}
