import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';
export const runtime = 'nodejs';
const schema = z.object({ lead_id: z.string().uuid(), body: z.string().trim().min(2).max(3000) });
export async function POST(request: Request) {
  const customerId = await currentCustomerId(); if (!customerId) return NextResponse.json({ error: 'Sign in to message RNX.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Enter a message of 2 to 3,000 characters.' }, { status: 400 });
  try {
    const db = supabaseAdmin(); const { data: lead, error: ownError } = await db.from('rnx_leads').select('id,email,category').eq('id', parsed.data.lead_id).eq('customer_id', customerId).maybeSingle();
    if (ownError || !lead) return NextResponse.json({ error: 'Request not found in this customer account.' }, { status: 404 });
    const { error } = await db.from('rnx_lead_messages').insert({ lead_id: lead.id, customer_id: customerId, sender_role: 'customer', sender_name: 'Customer', body: parsed.data.body });
    if (error) throw error;
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    const ops = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim(); if (ops) await queueNotification(db,{recipientEmail:ops,subject:`New customer message — ${lead.category}`,bodyText:`A customer sent a message about request ${lead.id}. Review it in RNX Operations → Customer communications.`,relatedLeadId:lead.id});
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { console.error('[RNX customer] Message failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'Your message could not be sent.' }, { status: 503 }); }
}
