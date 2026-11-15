import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ADMIN_COOKIE, isSameOriginRequest, isValidAdminSession } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('record_supplier_acceptance') }),
  z.object({ action: z.literal('verify_payment'), paymentReference: z.string().trim().min(3).max(120), paymentAmount: z.coerce.number().finite().min(0).max(100000000) }),
  z.object({ action: z.literal('record_refund'), reference: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal('record_credit'), reference: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal('record_contact_release') }),
  z.object({ action: z.literal('regenerate_consent_link') }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const jar = await cookies();
  if (!isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid offer.' }, { status: 400 });
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid offer operation.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data: offer, error: lookupError } = await db.from('rnx_lead_offers')
      .select('id,lead_id,payment_status,payment_verified_at,supplier_accepted_at,supplier_declined_at,customer_approved_at,customer_declined_at,contact_released_at')
      .eq('id', id).maybeSingle();
    if (lookupError || !offer) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });

    if (parsed.data.action === 'regenerate_consent_link') {
      if (offer.supplier_declined_at || offer.customer_approved_at || offer.customer_declined_at || offer.contact_released_at) {
        return NextResponse.json({ error: 'A new consent link cannot be issued after the customer has made a decision or contact was released.' }, { status: 409 });
      }
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await db.from('rnx_lead_offers').update({ customer_approval_token_hash: tokenHash, customer_approval_token_expires_at: expiresAt }).eq('id', id);
      if (error) return NextResponse.json({ error: 'A new approval link could not be generated.' }, { status: 503 });
      const approvalUrl = new URL('/introduction/approval', site.url);
      approvalUrl.searchParams.set('token', rawToken);
      await db.from('rnx_admin_audit_log').insert({ action: 'consent_link_regenerated', entity_type: 'lead', entity_id: offer.lead_id, details: { offer_id: id, expires_at: expiresAt } });
      return NextResponse.json({ ok: true, approvalUrl: approvalUrl.toString(), expiresAt }, { headers: { 'Cache-Control': 'no-store, private' } });
    }

    if (parsed.data.action === 'record_supplier_acceptance') {
      const { data, error } = await db.rpc('rnx_record_supplier_acceptance', { p_offer_id: id });
      if (error) return NextResponse.json({ error: 'Supplier acceptance could not be recorded. Confirm migration 004 is applied.' }, { status: 503 });
      const result = data as { ok?: boolean; error?: string; already_accepted?: boolean };
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Supplier acceptance was not accepted.' }, { status: 409 });
      await db.from('rnx_admin_audit_log').insert({ action: 'supplier_accepted_offer', entity_type: 'lead', entity_id: offer.lead_id, details: { offer_id: id } });
      return NextResponse.json({ ok: true, message: result.already_accepted ? 'Supplier acceptance was already recorded.' : 'Supplier acceptance recorded. Payment can now be verified.' });
    }

    if (parsed.data.action === 'verify_payment') {
      const { data, error } = await db.rpc('rnx_verify_offer_payment', {
        p_offer_id: id, p_payment_reference: parsed.data.paymentReference, p_payment_amount: parsed.data.paymentAmount,
      });
      if (error) {
        console.error('[RNX offers] Payment verification RPC failed:', { code: error.code, message: error.message });
        return NextResponse.json({ error: 'Payment verification could not be recorded. Confirm migration 004 is applied.' }, { status: 503 });
      }
      const result = data as { ok?: boolean; error?: string; already_paid?: boolean };
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Payment verification was rejected.' }, { status: 409 });
      await db.from('rnx_admin_audit_log').insert({ action: 'payment_verified', entity_type: 'lead', entity_id: offer.lead_id, details: { offer_id: id, payment_reference: parsed.data.paymentReference, amount: parsed.data.paymentAmount } });
      return NextResponse.json({ ok: true, message: result.already_paid ? 'Payment was already verified.' : 'Payment verified and recorded.' });
    }

    if (parsed.data.action === 'record_contact_release') {
      const { data, error } = await db.rpc('rnx_record_contact_release', { p_offer_id: id });
      if (error) {
        console.error('[RNX offers] Contact release RPC failed:', { code: error.code, message: error.message });
        return NextResponse.json({ error: 'Contact release could not be recorded. Confirm migration 004 is applied.' }, { status: 503 });
      }
      const result = data as { ok?: boolean; error?: string; already_released?: boolean };
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Contact release is not permitted.' }, { status: 409 });
      await db.from('rnx_admin_audit_log').insert({ action: 'contact_released', entity_type: 'lead', entity_id: offer.lead_id, details: { offer_id: id } });
      return NextResponse.json({ ok: true, message: result.already_released ? 'Contact release was already recorded.' : 'Contact release recorded. This entry should only be made after the authorised contact handoff is complete.' });
    }

    if (offer.contact_released_at) return NextResponse.json({ error: 'Contact has already been released. A payment adjustment cannot be processed from this console.' }, { status: 409 });
    const pAction = parsed.data.action === 'record_refund' ? 'refund' : 'credit';
    const { data, error } = await db.rpc('rnx_adjust_offer_payment', { p_offer_id: id, p_action: pAction, p_reference: parsed.data.reference || null });
    if (error) return NextResponse.json({ error: 'Payment adjustment could not be recorded. Confirm migration 004 is applied.' }, { status: 503 });
    const result = data as { ok?: boolean; error?: string; status?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Payment adjustment was rejected.' }, { status: 409 });
    await db.from('rnx_admin_audit_log').insert({ action: `payment_${result.status}`, entity_type: 'lead', entity_id: offer.lead_id, details: { offer_id: id, reference: parsed.data.reference || null } });
    return NextResponse.json({ ok: true, message: `Payment marked ${result.status}.` });
  } catch (error) {
    console.error('[RNX offers] Offer action unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Offer operations are temporarily unavailable.' }, { status: 503 });
  }
}
