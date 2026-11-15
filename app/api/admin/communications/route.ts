import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';
import { recordStaffActivity } from '@/lib/staff-activity';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ lead_id: z.string().uuid(), body: z.string().trim().min(2).max(3000) });
async function authorised(permission: 'communications:read' | 'communications:write') { const actor = await getAdminSession(); return { actor, allowed: Boolean(actor && hasPermission(actor.role, permission)) }; }
export async function GET() {
  const access = await authorised('communications:read');
  if (!access.actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: 'You do not have permission to read customer communications.' }, { status: 403 });
  try {
    const db = supabaseAdmin(); const { data: messages, error } = await db.from('rnx_lead_messages').select('id,lead_id,sender_role,sender_name,body,created_at').order('created_at',{ascending:false}).limit(200);
    if (error) throw error;
    const ids = [...new Set((messages || []).map((m: any) => m.lead_id))]; let leads: any[] = [];
    if (ids.length) { const result = await db.from('rnx_leads').select('id,name,email,phone,category,state,city,status,created_at').in('id',ids); if (result.error) throw result.error; leads = result.data || []; }
    const { data: notices } = await db.from('rnx_notifications').select('id,status,recipient_email,subject,attempts,last_error,failure_code,next_attempt_at,created_at').order('created_at',{ascending:false}).limit(50);
    return NextResponse.json({ messages: (messages || []).map((m: any) => ({ ...m, lead: leads.find((l: any) => l.id === m.lead_id) || null })), notifications: notices || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { console.error('[RNX admin communications] Load failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'Customer communications could not be loaded. Confirm migration 006.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const access = await authorised('communications:write');
  if (!access.actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: 'You do not have permission to reply to customer messages.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Choose a request and enter a message.' }, { status: 400 });
  try {
    const db = supabaseAdmin(); const { data: lead, error: leadError } = await db.from('rnx_leads').select('id,name,email,category').eq('id',parsed.data.lead_id).maybeSingle();
    if (leadError || !lead) return NextResponse.json({ error: 'Customer request not found.' }, { status: 404 });
    const { error } = await db.from('rnx_lead_messages').insert({ lead_id: lead.id, sender_role: 'operations', sender_name: 'RNX Operations', body: parsed.data.body });
    if (error) throw error;
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id',lead.id);
    if (access.actor) await recordStaffActivity(db, access.actor, 'customer_message_replied', 'lead', lead.id, { message_id: null });
    if (lead.email) await queueNotification(db,{recipientEmail:lead.email,subject:`Update from RuffNeck Exchange — ${lead.category}`,bodyText:`Hello ${lead.name},\n\nRNX Operations has replied to your request. Open your private request tracking link to read the message and reply.\n\nFor security, this notification does not include a private tracking link. Use the link you saved when you submitted your request.`,relatedLeadId:lead.id});
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { console.error('[RNX admin communications] Reply failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'The reply could not be saved.' }, { status: 503 }); }
}
