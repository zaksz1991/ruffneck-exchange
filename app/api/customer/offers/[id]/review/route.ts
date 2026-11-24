import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentCustomerId } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(2000),
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to leave a verified review.' }, { status: 401 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid introduction reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide a rating from 1–5, a title of 3–120 characters and a review of 20–2,000 characters.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data: outcome, error: outcomeError } = await db.from('rnx_transaction_outcomes')
      .select('lead_offer_id,customer_id,supplier_application_id,status')
      .eq('lead_offer_id', id)
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .maybeSingle();
    if (outcomeError) throw outcomeError;
    if (!outcome) return NextResponse.json({ error: 'A verified review is available only after both you and the supplier confirm that the introduced transaction was completed.' }, { status: 409 });

    const { data, error } = await db.from('rnx_supplier_reviews').insert({
      lead_offer_id: id,
      customer_id: customerId,
      supplier_application_id: outcome.supplier_application_id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
    }).select('id,rating,title,body,moderation_status,created_at').single();
    if (error?.code === '23505') return NextResponse.json({ error: 'A review has already been submitted for this introduction.' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ ok: true, review: data, message: 'Review submitted. It will appear on the supplier profile after RNX moderation.' }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX customer] Verified review submission failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your review could not be submitted. Confirm migration 023 is applied.' }, { status: 503 });
  }
}
