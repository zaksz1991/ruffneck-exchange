import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ subscriptionId: z.string().uuid(), transactionReference: z.string().trim().min(3).max(120), paymentMethod: z.enum(['bank_transfer','other']).default('bank_transfer'), note: z.string().trim().max(500).optional() });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter the payment reference shown by your bank or payment provider.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: subscription, error: subscriptionError } = await db.from('rnx_membership_subscriptions')
      .select('id,status,quoted_amount,currency,quote_expires_at')
      .eq('id', parsed.data.subscriptionId).eq('supplier_application_id', supplier.id).maybeSingle();
    if (subscriptionError || !subscription) return NextResponse.json({ error: 'Membership request not found.' }, { status: 404 });
    if (subscription.status !== 'awaiting_payment' || Number(subscription.quoted_amount) <= 0) return NextResponse.json({ error: 'This membership is not currently awaiting payment.' }, { status: 409 });
    if (subscription.quote_expires_at && new Date(subscription.quote_expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Your quotation has expired. Contact RNX operations for a revised quotation.' }, { status: 409 });
    const { data: pending } = await db.from('rnx_membership_payments').select('id').eq('subscription_id', subscription.id).eq('status', 'pending').limit(1).maybeSingle();
    if (pending) return NextResponse.json({ error: 'A payment reference is already awaiting review for this membership.' }, { status: 409 });
    const { data, error } = await db.from('rnx_membership_payments').insert({
      subscription_id: subscription.id,
      amount: subscription.quoted_amount,
      currency: subscription.currency,
      payment_method: parsed.data.paymentMethod,
      transaction_reference: parsed.data.transactionReference,
      supplier_note: parsed.data.note || null,
      status: 'pending',
    }).select('id,status').single();
    if (error || !data) {
      if (error?.code === '23505') return NextResponse.json({ error: 'That payment reference has already been submitted.' }, { status: 409 });
      console.error('[RNX membership payment]', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'The payment reference could not be recorded.' }, { status: 503 });
    }
    await db.from('rnx_membership_events').insert({ subscription_id: subscription.id, event_type: 'payment_reference_submitted', details: { payment_id: data.id, reference: parsed.data.transactionReference } });
    return NextResponse.json({ ok: true, message: 'Payment reference recorded. Membership remains inactive until RNX verifies receipt.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX membership payment]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Payment reference submission is temporarily unavailable.' }, { status: 503 });
  }
}
