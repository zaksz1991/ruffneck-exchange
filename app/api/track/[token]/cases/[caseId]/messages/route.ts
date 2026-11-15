import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ token: string; caseId: string }> };
const schema = z.object({ body: z.string().trim().min(2).max(3000) });

export async function POST(request: Request, context: Context) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a message of 2 to 3,000 characters.' }, { status: 400 });
  try {
    const { token, caseId } = await context.params;
    if (!/^[a-f0-9]{64}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(caseId)) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    const db = supabaseAdmin();
    const { data: lead, error: leadError } = await db.from('rnx_leads').select('id,category').eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
    if (leadError || !lead) return NextResponse.json({ error: 'This tracking link is invalid.' }, { status: 404 });
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id,case_reference,status').eq('id', caseId).eq('lead_id', lead.id).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'Case not found for this request.' }, { status: 404 });
    if (trustCase.status === 'closed') return NextResponse.json({ error: 'This case is closed. Send a new request message if you need further help.' }, { status: 409 });

    const { error } = await db.from('rnx_trust_case_messages').insert({ trust_case_id: trustCase.id, sender_role: 'customer', sender_name: 'Customer', visibility: 'customer', body: parsed.data.body });
    if (error) throw error;
    await db.from('rnx_trust_cases').update({ updated_at: new Date().toISOString() }).eq('id', trustCase.id);
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (operationsEmail) {
      try { await queueNotification(db, { recipientEmail: operationsEmail, subject: `Customer update — ${trustCase.case_reference}`, bodyText: `A customer added a message to case ${trustCase.case_reference}. Review it in RNX Operations → Trust & resolution.`, relatedLeadId: lead.id }); }
      catch (notificationError) { console.error('[RNX trust cases] Notification queue failed after message save:', notificationError instanceof Error ? notificationError.message : 'unknown'); }
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX trust cases] Customer message failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your message could not be saved.' }, { status: 503 });
  }
}
