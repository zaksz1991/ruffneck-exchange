import { NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { loadCommercialQuoteMessages } from '@/lib/commercial-quote-messages';
import { uploadCommercialQuoteAttachment } from '@/lib/commercial-quote-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid quotation reference.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const access = await loadCommercialQuoteMessages(id, 'customer', customerId);
    if (access.notFound) return NextResponse.json({ error: 'Quotation conversation not found in this customer account.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (!access.canSend) return NextResponse.json({ error: 'This quotation is closed. New attachments are no longer accepted.' }, { status: 409, headers: PRIVATE_HEADERS });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF or image file to attach.' }, { status: 400, headers: PRIVATE_HEADERS });
    const note = String(form.get('message_body') || '');
    const result = await uploadCommercialQuoteAttachment(supabaseAdmin(), {
      quoteId: id, senderRole: 'customer', senderId: customerId, file, note,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, message_id: result.message_id, attachment_id: result.attachment_id, file_name: result.file_name }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer quote attachment] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The attachment could not be uploaded. Confirm migration 027 and private storage are ready.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
