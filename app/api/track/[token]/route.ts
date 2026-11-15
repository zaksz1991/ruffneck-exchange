import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const messageSchema = z.object({ body: z.string().trim().min(2).max(3000) });
type Context = { params: Promise<{ token: string }> };
async function findLead(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from('rnx_leads').select('id,request_type,name,state,city,category,details,status,contact_release_status,created_at,last_activity_at').eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
  if (error) throw error;
  return data;
}
export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params; const lead = await findLead(token);
    if (!lead) return NextResponse.json({ error: 'This tracking link is invalid or has expired.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const { data: messages, error } = await supabaseAdmin().from('rnx_lead_messages').select('id,sender_role,sender_name,body,created_at').eq('lead_id',lead.id).order('created_at',{ascending:true}).limit(200);
    if (error) throw error;
    return NextResponse.json({ request: lead, messages: messages || [] }, { headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { console.error('[RNX tracking] Lookup failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'Request tracking is temporarily unavailable.' }, { status: 503 }); }
}
export async function POST(request: Request, context: Context) {
  const parsed = messageSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Enter a message of 2 to 3,000 characters.' }, { status: 400 });
  try {
    const { token } = await context.params; const lead = await findLead(token);
    if (!lead) return NextResponse.json({ error: 'This tracking link is invalid or has expired.' }, { status: 404 });
    const db = supabaseAdmin(); const { error } = await db.from('rnx_lead_messages').insert({ lead_id: lead.id, sender_role: 'customer', sender_name: 'Customer', body: parsed.data.body });
    if (error) throw error;
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id',lead.id);
    const ops = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim(); if (ops) await queueNotification(db,{recipientEmail:ops,subject:`New customer message — ${lead.category}`,bodyText:`A customer sent a message about request ${lead.id}. Review it in RNX Operations → Customer communications.`,relatedLeadId:lead.id});
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('[RNX tracking] Message failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'Your message could not be sent.' }, { status: 503 }); }
}
