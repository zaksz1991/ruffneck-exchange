import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { currentCustomerId, createTrackingToken, hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';
import { trackingUrl } from '@/lib/notifications';

export const runtime = 'nodejs';
const schema = z.object({
  request_type: z.enum(['product', 'service', 'bulk', 'partnership', 'other']),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  phone: z.string().trim().min(7).max(30),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  category: z.string().trim().min(2).max(100),
  details: z.string().trim().min(30).max(4000),
  preferred_contact: z.enum(['phone', 'whatsapp', 'email']),
  consent: z.literal('yes')
});

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Some details are missing or invalid. Review the form and try again.', issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const trackingToken = createTrackingToken();
    const customerId = await currentCustomerId();
    const { data: lead, error } = await db.from('rnx_leads').insert({
      ...parsed.data, email: parsed.data.email || null, city: parsed.data.city || null,
      customer_id: customerId, tracking_token_hash: hashTrackingToken(trackingToken),
      status: 'new', contact_release_status: 'locked', last_activity_at: new Date().toISOString()
    }).select('id').single();
    if (error || !lead) {
      console.error('[RNX] Lead insert failed:', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'We could not save your request right now. Please try again later.' }, { status: 503 });
    }
    const url = trackingUrl(trackingToken);
    if (parsed.data.email) {
      await queueNotification(db, {
        recipientEmail: parsed.data.email,
        subject: `RuffNeck Exchange request received — ${lead.id.slice(0, 8)}`,
        bodyText: `We received your ${parsed.data.category} request. Our operations team will review it.\n\nUse this private link to follow updates and message RNX: ${url}\n\nKeep this link private. It grants access to this request. Your contact details are not released to a supplier without an authorised introduction.`,
        relatedLeadId: lead.id
      });
    }
    const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (operationsEmail) {
      await queueNotification(db, { recipientEmail: operationsEmail, subject: `New RNX customer request: ${parsed.data.category}`, bodyText: `A new customer request was submitted.\nReference: ${lead.id}\nCategory: ${parsed.data.category}\nLocation: ${[parsed.data.city, parsed.data.state].filter(Boolean).join(', ')}\nReview it in the RNX operations console.`, relatedLeadId: lead.id });
    }
    return NextResponse.json({ ok: true, id: lead.id, trackingUrl: url, message: 'Request received. Save your private tracking link to follow updates and message RNX.' }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX] Lead endpoint unavailable:', error instanceof Error ? error.message : 'Unknown server error');
    return NextResponse.json({ error: 'Customer request submission is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
