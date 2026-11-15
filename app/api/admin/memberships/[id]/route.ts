import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('quote'), amount: z.coerce.number().finite().min(1).max(100000000000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Enter an amount with no more than two decimal places.'), interval: z.enum(['monthly','annual']), validityDays: z.coerce.number().int().min(1).max(30).default(7) }),
  z.object({ action: z.literal('verify_payment'), paymentId: z.string().uuid(), receivedAmount: z.coerce.number().finite().positive().max(100000000000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Received amount must have no more than two decimal places.'), receivedCurrency: z.literal('NGN'), verifiedReference: z.string().trim().min(3).max(120) }),
  z.object({ action: z.literal('reject_payment'), paymentId: z.string().uuid(), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal('reject_request'), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal('cancel_membership') }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid membership request.' }, { status: 400 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid membership operation.' }, { status: 400 });
  const requiredPermission = ['verify_payment','reject_payment'].includes(parsed.data.action) ? 'payments:verify' : 'memberships:write';
  if (!hasPermission(actor.role, requiredPermission)) return NextResponse.json({ error: 'You do not have permission to perform this membership action.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const { data: membership, error: lookupError } = await db.from('rnx_membership_subscriptions')
      .select('id,supplier_application_id,status,quoted_amount,currency,plan:rnx_membership_plans!inner(code,name)')
      .eq('id', id).maybeSingle();
    if (lookupError || !membership) return NextResponse.json({ error: 'Membership request not found.' }, { status: 404 });
    let message = '';
    const action = parsed.data.action;

    if (action === 'quote') {
      if (!['requested','awaiting_payment'].includes(membership.status)) return NextResponse.json({ error: 'Only a pending membership request can be quoted.' }, { status: 409 });
      const { data: pendingPayment, error: pendingPaymentError } = await db.from('rnx_membership_payments')
        .select('id').eq('subscription_id', id).eq('status', 'pending').limit(1).maybeSingle();
      if (pendingPaymentError) return NextResponse.json({ error: 'Existing payment submissions could not be checked.' }, { status: 503 });
      if (pendingPayment) return NextResponse.json({ error: 'A supplier payment reference is already awaiting review. Verify or reject it before changing the quotation.' }, { status: 409 });
      const expiresAt = new Date(Date.now() + parsed.data.validityDays * 86400000).toISOString();
      const { error } = await db.from('rnx_membership_subscriptions').update({
        status: 'awaiting_payment', quoted_amount: parsed.data.amount, currency: 'NGN',
        billing_interval: parsed.data.interval, quote_expires_at: expiresAt, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) return NextResponse.json({ error: 'Membership quotation could not be saved.' }, { status: 503 });
      await db.from('rnx_membership_events').insert({ subscription_id: id, event_type: 'commercial_quote_issued', details: { amount: parsed.data.amount, currency: 'NGN', interval: parsed.data.interval, expires_at: expiresAt } });
      message = `Quotation issued. It expires ${new Date(expiresAt).toLocaleDateString('en-NG')}.`;
    } else if (action === 'verify_payment') {
      const { data, error } = await db.rpc('rnx_verify_membership_payment', { p_payment_id: parsed.data.paymentId, p_received_amount: parsed.data.receivedAmount, p_received_currency: parsed.data.receivedCurrency, p_verified_reference: parsed.data.verifiedReference, p_verified_by: 'rnx-admin' });
      if (error) {
        console.error('[RNX membership verification]', { code: error.code, message: error.message });
        return NextResponse.json({ error: 'Payment verification failed. Confirm migration 005 is applied.' }, { status: 503 });
      }
      const result = data as { ok?: boolean; error?: string; already_verified?: boolean };
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Payment was not verified.' }, { status: 409 });
      message = result.already_verified ? 'Payment was already verified.' : 'The independently confirmed receipt matches the quotation. Membership is now active.';
    } else if (action === 'reject_payment') {
      const { data: payment, error: paymentLookupError } = await db.from('rnx_membership_payments')
        .select('id,status').eq('id', parsed.data.paymentId).eq('subscription_id', id).maybeSingle();
      if (paymentLookupError || !payment) return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
      if (payment.status !== 'pending') return NextResponse.json({ error: 'Only pending payments can be rejected.' }, { status: 409 });
      const { error } = await db.from('rnx_membership_payments').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', payment.id);
      if (error) return NextResponse.json({ error: 'Payment rejection could not be saved.' }, { status: 503 });
      await db.from('rnx_membership_events').insert({ subscription_id: id, event_type: 'payment_reference_rejected', details: { payment_id: payment.id, reason: parsed.data.reason || null } });
      message = 'Payment reference rejected. The supplier can submit a corrected reference.';
    } else if (action === 'reject_request') {
      if (['active','cancelled','superseded'].includes(membership.status)) return NextResponse.json({ error: 'This membership cannot be rejected in its current state.' }, { status: 409 });
      const { error } = await db.from('rnx_membership_subscriptions').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id);
      if (error) return NextResponse.json({ error: 'Membership request could not be rejected.' }, { status: 503 });
      await db.from('rnx_membership_payments').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('subscription_id', id).eq('status', 'pending');
      await db.from('rnx_membership_events').insert({ subscription_id: id, event_type: 'membership_request_rejected', details: { reason: parsed.data.reason || null } });
      message = 'Membership request rejected.';
    } else {
      if (membership.status !== 'active') return NextResponse.json({ error: 'Only active memberships can be cancelled.' }, { status: 409 });
      const { error } = await db.from('rnx_membership_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
      if (error) return NextResponse.json({ error: 'Membership could not be cancelled.' }, { status: 503 });
      await db.from('rnx_membership_events').insert({ subscription_id: id, event_type: 'membership_cancelled', details: {} });
      message = 'Membership cancelled. Review the supplier account before any further service.';
    }

    await db.from('rnx_admin_audit_log').insert({ action: `membership_${action}`, entity_type: 'membership', entity_id: id, details: { action } });
    await recordStaffActivity(db, actor, `membership_${action}`, 'membership', id, { action });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('[RNX admin membership action]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Membership operation is temporarily unavailable.' }, { status: 503 });
  }
}
