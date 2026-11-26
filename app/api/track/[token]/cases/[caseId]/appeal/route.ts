import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashTrackingToken } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ token: string; caseId: string }> };
const schema = z.object({ reason: z.string().trim().min(20).max(2000) });

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Explain why the resolution should be reviewed in 20–2,000 characters.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const { token, caseId } = await context.params;
    if (!/^[a-f0-9]{64}$/i.test(token) || !UUID_PATTERN.test(caseId)) {
      return NextResponse.json({ error: 'This private case link is invalid.' }, { status: 404, headers: PRIVATE_HEADERS });
    }
    const db = supabaseAdmin();
    const { data: lead, error: leadError } = await db.from('rnx_leads')
      .select('id,name,email,category')
      .eq('tracking_token_hash', hashTrackingToken(token))
      .maybeSingle();
    if (leadError || !lead) return NextResponse.json({ error: 'This private tracking link is invalid or unavailable.' }, { status: 404, headers: PRIVATE_HEADERS });

    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases')
      .select('id,case_reference,lead_id,status')
      .eq('id', caseId)
      .eq('lead_id', lead.id)
      .maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'Case not found for this private tracking link.' }, { status: 404, headers: PRIVATE_HEADERS });

    const { data: appealId, error: appealError } = await db.rpc('rnx_submit_trust_case_appeal', {
      p_case_id: caseId,
      p_customer_reason: parsed.data.reason,
    });
    if (appealError) {
      const message = String(appealError.message || '');
      if (message.includes('TRUST_CASE_APPEAL_WINDOW_EXPIRED')) return NextResponse.json({ error: 'The 14-day resolution review window has ended.' }, { status: 410, headers: PRIVATE_HEADERS });
      if (message.includes('TRUST_CASE_APPEAL_EXISTS')) return NextResponse.json({ error: 'A review request has already been submitted for this case.' }, { status: 409, headers: PRIVATE_HEADERS });
      if (message.includes('TRUST_CASE_NOT_RESOLVED')) return NextResponse.json({ error: 'Only a resolved or closed case with a published outcome can be appealed.' }, { status: 409, headers: PRIVATE_HEADERS });
      if (message.includes('TRUST_CASE_APPEAL_REASON_INVALID')) return NextResponse.json({ error: 'The review explanation must contain 20–2,000 characters.' }, { status: 400, headers: PRIVATE_HEADERS });
      throw appealError;
    }

    const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (operationsEmail) {
      try {
        await queueNotification(db, {
          recipientEmail: operationsEmail,
          subject: `Resolution review requested — ${trustCase.case_reference}`,
          bodyText: `A customer has requested a review of the published outcome for case ${trustCase.case_reference}. Open RNX Operations → Trust & resolution and review the appeal. The private tracking link is not included in this email.`,
          relatedLeadId: lead.id,
        });
      } catch (notificationError) {
        console.error('[RNX trust appeals] Operations notification failed:', notificationError instanceof Error ? notificationError.message : 'unknown');
      }
    }

    return NextResponse.json({ ok: true, appealId }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX trust appeals] Customer appeal submission failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your resolution review request could not be submitted.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
