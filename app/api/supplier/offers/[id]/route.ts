import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ action: z.enum(['accept','decline']), note: z.string().trim().max(500).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid opportunity.' }, { status: 400 });
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Choose accept or decline.' }, { status: 400 });
  try {
    const { data, error } = await supabaseAdmin().rpc('rnx_supplier_respond_to_offer', {
      p_offer_id: id,
      p_supplier_id: supplier.id,
      p_decision: parsed.data.action,
      p_note: parsed.data.note || null,
    });
    if (error) {
      console.error('[RNX supplier offer response]', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Offer response could not be saved. Confirm migration 005 is applied.' }, { status: 503 });
    }
    const result = data as { ok?: boolean; error?: string; decision?: string; already_recorded?: boolean };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Offer response was rejected.' }, { status: 409 });
    return NextResponse.json({ ok: true, message: result.already_recorded ? `Your ${parsed.data.action} response was already recorded.` : `Opportunity ${result.decision}.` }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier offer response]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Opportunity response is temporarily unavailable.' }, { status: 503 });
  }
}
