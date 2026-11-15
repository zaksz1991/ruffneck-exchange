import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { site } from '@/lib/site';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  leadId: z.string().uuid(),
  supplierId: z.string().uuid(),
  anonymisedSummary: z.string().trim().min(30).max(1200),
  quotedFee: z.coerce.number().finite().min(0).max(100000000),
});


export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'payments:verify')) return NextResponse.json({ error: 'You do not have permission to view lead-fee payments.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from('rnx_lead_offers')
      .select('id,lead_id,supplier_application_id,anonymised_summary,quoted_fee,currency,payment_status,payment_reference,payment_amount,supplier_accepted_at,payment_verified_at,customer_approved_at,customer_declined_at,contact_released_at,created_at,supplier:rnx_supplier_applications!inner(business_name),lead:rnx_leads!inner(request_type,category,state,city,status)')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    // Finance receives only anonymised offer and payment facts. Customer name, phone and email are excluded.
    return NextResponse.json({ offers: data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX finance] Offer payment list failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Lead-fee payment records could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:write')) return NextResponse.json({ error: 'You do not have permission to prepare supplier offers.' }, { status: 403 });
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Check the lead, supplier, summary and fee.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const [{ data: lead, error: leadError }, { data: supplier, error: supplierError }] = await Promise.all([
      db.from('rnx_leads').select('id,name,email,phone,status,contact_release_status').eq('id', parsed.data.leadId).maybeSingle(),
      db.from('rnx_supplier_applications').select('id,status').eq('id', parsed.data.supplierId).maybeSingle(),
    ]);
    if (leadError || !lead) return NextResponse.json({ error: 'Customer request not found.' }, { status: 404 });
    if (supplierError || !supplier) return NextResponse.json({ error: 'Supplier record not found.' }, { status: 404 });
    if (!['qualified', 'matched'].includes(lead.status)) return NextResponse.json({ error: 'Qualify the customer request before preparing a supplier offer.' }, { status: 409 });
    if (supplier.status !== 'approved') return NextResponse.json({ error: 'Only approved suppliers can receive an opportunity offer.' }, { status: 409 });
    if (lead.contact_release_status === 'released') return NextResponse.json({ error: 'This request has already had contact released.' }, { status: 409 });

    const summary = parsed.data.anonymisedSummary;
    const summaryLower = summary.toLocaleLowerCase();
    const customerName = String(lead.name || '').trim().toLocaleLowerCase();
    const customerEmail = String(lead.email || '').trim().toLocaleLowerCase();
    const customerPhoneDigits = String(lead.phone || '').replace(/\D/g, '');
    const summaryDigits = summary.replace(/\D/g, '');
    const includesCustomerName = customerName.length >= 4 && summaryLower.includes(customerName);
    const includesCustomerEmail = customerEmail.length >= 5 && summaryLower.includes(customerEmail);
    const includesCustomerPhone = customerPhoneDigits.length >= 7 && summaryDigits.includes(customerPhoneDigits);
    const includesAnyEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(summary);
    if (includesCustomerName || includesCustomerEmail || includesCustomerPhone || includesAnyEmail) {
      return NextResponse.json({ error: 'The opportunity brief appears to contain customer-identifying information. Remove names, email addresses and phone numbers before creating the offer.' }, { status: 400 });
    }

    const { data: duplicate } = await db.from('rnx_lead_offers').select('id')
      .eq('lead_id', lead.id).eq('supplier_application_id', supplier.id)
      .is('contact_released_at', null).limit(1).maybeSingle();
    if (duplicate) return NextResponse.json({ error: 'An offer already exists for this supplier and customer request.' }, { status: 409 });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: offer, error } = await db.from('rnx_lead_offers').insert({
      lead_id: lead.id,
      supplier_application_id: supplier.id,
      anonymised_summary: parsed.data.anonymisedSummary,
      quoted_fee: parsed.data.quotedFee,
      payment_status: 'unpaid',
      customer_approval_token_hash: tokenHash,
      customer_approval_token_expires_at: expiresAt,
    }).select('id').single();
    if (error || !offer) {
      console.error('[RNX offers] Creation failed:', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'The supplier offer could not be created. Confirm migration 004 is applied.' }, { status: 503 });
    }

    const { error: eventError } = await db.from('rnx_lead_offer_events').insert({ lead_offer_id: offer.id, event_type: 'offer_created', details: { quoted_fee: parsed.data.quotedFee } });
    if (eventError) {
      await db.from('rnx_lead_offers').delete().eq('id', offer.id);
      console.error('[RNX offers] Offer event could not be recorded:', { code: eventError.code, message: eventError.message });
      return NextResponse.json({ error: 'The offer event could not be recorded. Confirm migration 004 is applied.' }, { status: 503 });
    }
    await db.from('rnx_admin_audit_log').insert({ action: 'offer_created', entity_type: 'lead', entity_id: lead.id, details: { offer_id: offer.id, supplier_id: supplier.id } });
    await recordStaffActivity(db, actor, 'supplier_opportunity_offer_created', 'lead', lead.id, { offer_id: offer.id, supplier_id: supplier.id });
    const approvalUrl = new URL('/introduction/approval', site.url);
    approvalUrl.searchParams.set('token', rawToken);
    return NextResponse.json({ ok: true, offerId: offer.id, approvalUrl: approvalUrl.toString(), expiresAt }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX offers] Endpoint unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Offer operations are temporarily unavailable.' }, { status: 503 });
  }
}
