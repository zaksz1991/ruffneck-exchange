import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ response: z.string().trim().min(2).max(1000) });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid review reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a response of 2–1,000 characters.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from('rnx_supplier_reviews')
      .update({ supplier_response: parsed.data.response, supplier_response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('supplier_application_id', supplier.id)
      .eq('moderation_status', 'approved')
      .is('supplier_response', null)
      .select('id,supplier_response,supplier_response_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'This review is not available for a response, or a response has already been recorded.' }, { status: 409 });
    return NextResponse.json({ ok: true, review: data, message: 'Your public response has been recorded.' }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier] Review response failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your response could not be saved. Confirm migration 023 is applied.' }, { status: 503 });
  }
}
