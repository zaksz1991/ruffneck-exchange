import { NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { loadCommercialQuoteMessages } from '@/lib/commercial-quote-messages';
import { COMMERCIAL_QUOTE_ATTACHMENT_BUCKET, COMMERCIAL_QUOTE_ATTACHMENT_SIGNED_URL_SECONDS } from '@/lib/commercial-quote-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string; messageId: string }> };

export async function GET(_request: Request, context: Context) {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id, messageId } = await context.params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(messageId)) return NextResponse.json({ error: 'Invalid attachment reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const access = await loadCommercialQuoteMessages(id, 'customer', customerId);
    if (access.notFound) return NextResponse.json({ error: 'Quotation conversation not found in this customer account.' }, { status: 404, headers: PRIVATE_HEADERS });
    const db = supabaseAdmin();
    const { data: attachment, error } = await db.from('rnx_commercial_quote_message_attachments')
      .select('storage_path,file_name')
      .eq('quote_id', id)
      .eq('message_id', messageId)
      .maybeSingle();
    if (error) throw error;
    if (!attachment) return NextResponse.json({ error: 'Attachment not found in this conversation.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data: signed, error: signError } = await db.storage.from(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, COMMERCIAL_QUOTE_ATTACHMENT_SIGNED_URL_SECONDS, { download: attachment.file_name });
    if (signError || !signed?.signedUrl) throw signError || new Error('Signed attachment link could not be created.');
    return new NextResponse(null, { status: 302, headers: { ...PRIVATE_HEADERS, Location: signed.signedUrl } });
  } catch (error) {
    console.error('[RNX customer quote attachment] Download link failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The attachment could not be opened.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
