import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentCustomerId } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const schema = z.object({ action: z.enum(['select', 'decline']) });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to respond to a supplier quotation.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid quotation reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose whether to mark the quotation as preferred or decline it.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('rnx_respond_to_commercial_quote', {
      p_quote_id: id,
      p_customer_id: customerId,
      p_decision: parsed.data.action,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; status?: string; quote_reference?: string; supplier_application_id?: string; lead_id?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Your quotation decision was rejected.' }, { status: 409, headers: PRIVATE_HEADERS });

    if (parsed.data.action === 'select' && result.supplier_application_id) {
      try {
        const { data: supplier } = await db.from('rnx_supplier_applications')
          .select('business_name,email')
          .eq('id', result.supplier_application_id)
          .maybeSingle();
        if (supplier?.email) {
          await queueNotification(db, {
            recipientEmail: supplier.email,
            subject: `Customer selected your quotation ${result.quote_reference || ''}`,
            bodyText: `A customer has marked your commercial quotation ${result.quote_reference || ''} as their preferred proposal. Sign in to your RuffNeck Exchange supplier dashboard to review the status. This selection records customer preference; it is not proof of payment or a completed contract.`,
            relatedLeadId: result.lead_id || null,
          });
        }
      } catch (notificationError) {
        console.error('[RNX supplier quote notification]', notificationError instanceof Error ? notificationError.message : 'notification failed');
      }
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      message: parsed.data.action === 'select'
        ? 'This quotation is now marked as your preferred proposal. Confirm final terms directly with the supplier; this is not a payment or binding contract.'
        : 'You declined this quotation. The supplier can submit a revised proposal.',
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Commercial quote decision failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your quotation decision could not be saved. Confirm migration 024 is applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
