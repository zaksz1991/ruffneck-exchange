import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:read')) return NextResponse.json({ error: 'You do not have permission to review supplier feedback.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [reviewResult, disputeResult] = await Promise.all([
      db.from('rnx_supplier_reviews')
        .select('id,lead_offer_id,rating,title,body,moderation_status,created_at,supplier_response,customer:rnx_customers!inner(name,email),supplier:rnx_supplier_applications!inner(business_name,public_slug)')
        .order('created_at', { ascending: false })
        .limit(150),
      db.from('rnx_transaction_outcomes')
        .select('id,lead_offer_id,customer_outcome,supplier_outcome,updated_at,customer:rnx_customers!inner(name,email),supplier:rnx_supplier_applications!inner(business_name),offer:rnx_lead_offers!inner(lead:rnx_leads!inner(id,category,state,city))')
        .eq('status', 'disputed')
        .order('updated_at', { ascending: false })
        .limit(100),
    ]);
    if (reviewResult.error) throw reviewResult.error;
    if (disputeResult.error) throw disputeResult.error;

    // Reviews and outcomes both reference lead_offers; they are sibling relations,
    // not a direct PostgREST relationship. Fetch outcomes separately and join by offer ID.
    const reviewRows = reviewResult.data ?? [];
    const offerIds = [...new Set(reviewRows.map((row: any) => row.lead_offer_id))];
    let outcomeRows: any[] = [];
    if (offerIds.length) {
      const { data, error } = await db.from('rnx_transaction_outcomes')
        .select('lead_offer_id,status,customer_outcome,supplier_outcome,completed_at')
        .in('lead_offer_id', offerIds);
      if (error) throw error;
      outcomeRows = data ?? [];
    }
    const outcomesByOffer = new Map(outcomeRows.map((row) => [row.lead_offer_id, row]));
    const reviews = reviewRows.map((row: any) => ({ ...row, outcome: outcomesByOffer.get(row.lead_offer_id) ?? null }));
    return NextResponse.json({ reviews, disputes: disputeResult.data ?? [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin] Reviews queue unavailable:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Supplier reviews could not be loaded. Confirm migration 023 is applied.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:write')) return NextResponse.json({ error: 'You do not have permission to moderate supplier reviews.' }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });

  const body = await request.json().catch(() => null) as { reviewId?: string; moderationStatus?: string } | null;
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.reviewId || '') || !['approved', 'rejected', 'hidden'].includes(body.moderationStatus || '')) {
    return NextResponse.json({ error: 'Choose a review and a valid moderation decision.' }, { status: 400 });
  }

  try {
    const db = supabaseAdmin();
    const moderatedAt = new Date().toISOString();
    const { data, error } = await db.from('rnx_supplier_reviews')
      .update({ moderation_status: body.moderationStatus, moderated_at: moderatedAt, moderated_by_staff_id: actor.id, updated_at: moderatedAt })
      .eq('id', body.reviewId)
      .select('id,lead_offer_id,rating,title,moderation_status,moderated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });

    const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
      action: 'supplier_review_moderated',
      entity_type: 'lead',
      entity_id: data.lead_offer_id,
      details: { review_id: data.id, moderation_status: data.moderation_status, rating: data.rating },
    });
    if (auditError) console.error('[RNX review moderation audit]', auditError.message);
    return NextResponse.json({ ok: true, review: data }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin] Review moderation failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Review moderation could not be saved.' }, { status: 503 });
  }
}
