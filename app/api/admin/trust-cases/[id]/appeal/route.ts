import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  decision: z.enum(['accepted', 'not_upheld']),
  staffResponse: z.string().trim().min(10).max(1800),
});

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  if (!hasPermission(actor.role, 'trust:write')) return NextResponse.json({ error: 'You do not have permission to review customer appeals.' }, { status: 403, headers: PRIVATE_HEADERS });

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose an appeal decision and provide a customer-visible response of 10–1,800 characters.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: lookupError } = await db.from('rnx_trust_cases')
      .select('id,case_reference,lead_id,status,lead:rnx_leads!inner(id,name,email,category)')
      .eq('id', id)
      .maybeSingle();
    if (lookupError || !trustCase) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404, headers: PRIVATE_HEADERS });

    const { data: appealId, error: reviewError } = await db.rpc('rnx_review_trust_case_appeal', {
      p_case_id: id,
      p_staff_id: actor.id,
      p_reviewer_email: actor.email,
      p_decision: parsed.data.decision,
      p_staff_response: parsed.data.staffResponse,
    });
    if (reviewError) {
      const message = String(reviewError.message || '');
      if (message.includes('TRUST_CASE_APPEAL_NOT_FOUND')) return NextResponse.json({ error: 'No customer appeal exists for this case.' }, { status: 404, headers: PRIVATE_HEADERS });
      if (message.includes('TRUST_CASE_APPEAL_ALREADY_REVIEWED')) return NextResponse.json({ error: 'This appeal has already been reviewed. Refresh the case to see the recorded decision.' }, { status: 409, headers: PRIVATE_HEADERS });
      if (message.includes('TRUST_CASE_APPEAL_RESPONSE_INVALID')) return NextResponse.json({ error: 'The customer-visible response must contain 10–1,800 characters.' }, { status: 400, headers: PRIVATE_HEADERS });
      throw reviewError;
    }

    const lead = Array.isArray(trustCase.lead) ? trustCase.lead[0] : trustCase.lead;
    if (lead?.email) {
      const accepted = parsed.data.decision === 'accepted';
      try {
        await queueNotification(db, {
          recipientEmail: lead.email,
          subject: `Resolution review update — ${trustCase.case_reference} | RuffNeck Exchange`,
          bodyText: `Hello ${lead.name || 'Customer'},\n\nRNX Operations has reviewed your request to reconsider the published outcome for case ${trustCase.case_reference}.\n\nDecision: ${accepted ? 'Further review accepted. The case has been reopened for Operations review.' : 'The original resolution remains in place.'}\n\nStaff response: ${parsed.data.staffResponse}\n\nOpen your private request tracking link to follow the case. This email does not contain that link.`,
          relatedLeadId: lead.id,
        });
      } catch (notificationError) {
        console.error('[RNX trust appeals] Customer notification failed:', notificationError instanceof Error ? notificationError.message : 'unknown');
      }
    }

    await recordStaffActivity(db, actor, 'trust_case_appeal_reviewed', 'trust_case', id, {
      case_reference: trustCase.case_reference,
      appeal_id: appealId,
      decision: parsed.data.decision,
    });

    return NextResponse.json({ ok: true, appealId, decision: parsed.data.decision }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX trust appeals] Staff review failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The customer appeal could not be reviewed.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
