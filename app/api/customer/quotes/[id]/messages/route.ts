import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentCustomerId } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { loadCommercialQuoteMessages } from '@/lib/commercial-quote-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messageSchema = z.object({ message_body: z.string().trim().min(2).max(2000) });
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid quotation reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { error: expiryError } = await db.rpc('rnx_expire_commercial_quotes');
    if (expiryError) throw expiryError;
    const result = await loadCommercialQuoteMessages(id, 'customer', customerId);
    if (result.notFound) return NextResponse.json({ error: 'Quotation conversation not found in this customer account.' }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer quote conversation] Load failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The quotation conversation could not be loaded. Confirm migration 026 is applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid quotation reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a message of 2 to 2,000 characters.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const { data, error } = await supabaseAdmin().rpc('rnx_send_commercial_quote_message', {
      p_quote_id: id, p_sender_role: 'customer', p_sender_id: customerId, p_message_body: parsed.data.message_body,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; message_id?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'The message could not be sent.' }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, message_id: result.message_id }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer quote conversation] Send failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your message could not be sent. Confirm migration 026 is applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
