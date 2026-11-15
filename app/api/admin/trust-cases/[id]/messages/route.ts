import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ body: z.string().trim().min(2).max(3000), visibility: z.enum(['customer','internal']) });

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:write')) return NextResponse.json({ error: 'You do not have permission to respond to trust cases.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a message and choose its visibility.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: lookupError } = await db.from('rnx_trust_cases').select('id,case_reference,lead_id,status').eq('id', id).maybeSingle();
    if (lookupError || !trustCase) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404 });
    if (trustCase.status === 'closed' && parsed.data.visibility === 'customer') return NextResponse.json({ error: 'This case is closed. Reopen it before sending a customer-visible reply.' }, { status: 409 });
    const { data: message, error } = await db.from('rnx_trust_case_messages').insert({ trust_case_id: id, sender_role: 'staff', sender_staff_id: actor.id, sender_name: actor.fullName, visibility: parsed.data.visibility, body: parsed.data.body }).select('id,created_at').single();
    if (error || !message) throw error || new Error('Message not saved.');
    await db.from('rnx_trust_cases').update({ updated_at: new Date().toISOString() }).eq('id', id);
    await db.from('rnx_trust_case_events').insert({ trust_case_id: id, actor_role: 'staff', actor_staff_id: actor.id, actor_email: actor.email, event_type: parsed.data.visibility === 'internal' ? 'internal_note_added' : 'customer_reply_added', details: { message_id: message.id } });
    await recordStaffActivity(db, actor, parsed.data.visibility === 'internal' ? 'trust_case_internal_note_added' : 'trust_case_customer_reply_added', 'trust_case', id, { case_reference: trustCase.case_reference, message_id: message.id });
    if (parsed.data.visibility === 'customer') {
      const { data: lead } = await db.from('rnx_leads').select('id,name,email,category').eq('id', trustCase.lead_id).maybeSingle();
      if (lead?.email) {
        try { await queueNotification(db, { recipientEmail: lead.email, subject: `Update on case ${trustCase.case_reference} — RuffNeck Exchange`, bodyText: `Hello ${lead.name},\n\nRNX Operations has posted a customer-visible update to case ${trustCase.case_reference} for your ${lead.category} request. Open your private request tracking link to read and reply.\n\nThis notice does not contain your private tracking link.`, relatedLeadId: lead.id }); }
        catch (notificationError) { console.error('[RNX trust cases] Customer notification queue failed after reply save:', notificationError instanceof Error ? notificationError.message : 'unknown'); }
      }
    }
    return NextResponse.json({ ok: true, message }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX trust cases] Staff message failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The case message could not be saved.' }, { status: 503 });
  }
}
