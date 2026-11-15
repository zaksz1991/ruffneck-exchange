import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ token: string }> };
const caseSchema = z.object({
  caseType: z.enum(['general_complaint','delivery_issue','product_quality','service_quality','payment_dispute','supplier_conduct','suspected_fraud','other']),
  summary: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(4000),
  requestedResolution: z.string().trim().max(1200).optional().default(''),
  offerId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request, context: Context) {
  const parsed = caseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose an issue type, provide a short summary and describe the issue in at least 20 characters.' }, { status: 400 });
  try {
    const { token } = await context.params;
    if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.json({ error: 'This tracking link is invalid.' }, { status: 404 });
    const db = supabaseAdmin();
    const { data: lead, error: leadError } = await db.from('rnx_leads').select('id,category').eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
    if (leadError || !lead) return NextResponse.json({ error: 'This tracking link is invalid or unavailable.' }, { status: 404 });

    let supplierApplicationId: string | null = null;
    let leadOfferId: string | null = null;
    if (parsed.data.offerId) {
      const { data: offer, error: offerError } = await db.from('rnx_lead_offers').select('id,supplier_application_id,payment_status,payment_verified_at,customer_approved_at,contact_released_at').eq('id', parsed.data.offerId).eq('lead_id', lead.id).maybeSingle();
      if (offerError) throw offerError;
      if (!offer || !offer.contact_released_at || offer.payment_status !== 'paid' || !offer.payment_verified_at || !offer.customer_approved_at) {
        return NextResponse.json({ error: 'You can select only a supplier introduction that has already been approved and released to you.' }, { status: 409 });
      }
      supplierApplicationId = offer.supplier_application_id;
      leadOfferId = offer.id;
    }

    const { count, error: countError } = await db.from('rnx_trust_cases').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id);
    if (countError) throw countError;
    if ((count ?? 0) >= 20) return NextResponse.json({ error: 'This request has reached the case-submission limit. Contact RNX Operations through the existing message thread.' }, { status: 429 });

    const { data: row, error } = await db.from('rnx_trust_cases').insert({
      lead_id: lead.id,
      lead_offer_id: leadOfferId,
      supplier_application_id: supplierApplicationId,
      case_type: parsed.data.caseType,
      summary: parsed.data.summary,
      description: parsed.data.description,
      requested_resolution: parsed.data.requestedResolution || null,
    }).select('id,case_reference,status,created_at').single();
    if (error || !row) throw error || new Error('Case was not created.');

    const { error: eventError } = await db.from('rnx_trust_case_events').insert({ trust_case_id: row.id, actor_role: 'customer', event_type: 'case_submitted', to_status: 'new', details: { submitted_via: 'private_tracking_link', lead_offer_id: leadOfferId } });
    if (eventError) console.error('[RNX trust cases] Initial event could not be recorded:', eventError.code);
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id);

    const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (operationsEmail) {
      try {
        await queueNotification(db, {
          recipientEmail: operationsEmail,
          subject: `New RNX case ${row.case_reference} — ${lead.category}`,
          bodyText: `A customer submitted a complaint or dispute against request ${lead.id}.\nCase: ${row.case_reference}\nSummary: ${parsed.data.summary}\nReview it in RNX Operations → Trust & resolution.`,
          relatedLeadId: lead.id,
        });
      } catch (notificationError) {
        console.error('[RNX trust cases] Notification queue failed after case creation:', notificationError instanceof Error ? notificationError.message : 'unknown');
      }
    }
    return NextResponse.json({ ok: true, case: row }, { status: 201, headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    console.error('[RNX trust cases] Customer case submission failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your report could not be saved. Use the existing request message thread to contact RNX Operations.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
