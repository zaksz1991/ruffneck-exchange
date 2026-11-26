import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const schema = z.object({ body: z.string().trim().min(10).max(3000) });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a response of 10–3,000 characters.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('rnx_supplier_submit_trust_case_response', {
      p_case_id: id,
      p_supplier_application_id: supplier.id,
      p_body: parsed.data.body,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; case_reference?: string; status?: string; case_id?: string; message_id?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Your case response was rejected.' }, { status: 409, headers: PRIVATE_HEADERS });

    const { data: trustCase } = await db.from('rnx_trust_cases').select('lead_id,case_reference').eq('id', id).maybeSingle();
    if (trustCase?.lead_id) {
      const { data: lead } = await db.from('rnx_leads').select('id,name,email,category').eq('id', trustCase.lead_id).maybeSingle();
      if (lead?.email) {
        try {
          await queueNotification(db, {
            recipientEmail: lead.email,
            subject: `Supplier response received — ${trustCase.case_reference}`,
            bodyText: `Hello ${lead.name || 'Customer'},\n\nThe supplier attached to your customer case ${trustCase.case_reference} has submitted a response. Sign in to your private request tracking link to read it and continue the case conversation.\n\nThis email does not contain your private tracking link.`,
            relatedLeadId: lead.id,
          });
        } catch (notificationError) {
          console.error('[RNX supplier trust cases] Customer notification failed:', notificationError instanceof Error ? notificationError.message : 'unknown');
        }
      }
      const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
      if (operationsEmail) {
        try {
          await queueNotification(db, {
            recipientEmail: operationsEmail,
            subject: `Supplier response received — ${trustCase.case_reference}`,
            bodyText: `The supplier attached to case ${trustCase.case_reference} submitted a response. Review the response in RNX Operations → Trust & resolution. The case has moved to under review.`,
            relatedLeadId: lead?.id || trustCase.lead_id,
          });
        } catch (notificationError) {
          console.error('[RNX supplier trust cases] Operations notification failed:', notificationError instanceof Error ? notificationError.message : 'unknown');
        }
      }
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      message: `Your response to ${result.case_reference || 'the case'} was sent to RNX Operations and the customer. The case is now under review.`,
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier trust cases] Response could not be saved:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your response could not be saved. Confirm migration 029 is applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
