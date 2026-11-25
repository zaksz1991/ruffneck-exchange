import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };

const submitSchema = z.object({
  offer_id: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  scope_description: z.string().trim().min(20).max(3000),
  total_amount: z.coerce.number().finite().min(0).max(100000000000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  delivery_terms: z.string().trim().min(2).max(1200),
  estimated_fulfilment: z.string().trim().max(160).optional().nullable(),
  valid_days: z.coerce.number().int().min(1).max(60),
  revision_of_quote_id: z.string().uuid().optional(),
});
const withdrawSchema = z.object({ quote_id: z.string().uuid(), action: z.literal('withdraw') });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the quotation title, scope, amount, currency, delivery terms and validity.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const { data, error } = parsed.data.revision_of_quote_id
      ? await db.rpc('rnx_submit_commercial_quote_revision', {
          p_previous_quote_id: parsed.data.revision_of_quote_id,
          p_supplier_id: supplier.id,
          p_title: parsed.data.title,
          p_scope_description: parsed.data.scope_description,
          p_total_amount: parsed.data.total_amount,
          p_currency: parsed.data.currency,
          p_delivery_terms: parsed.data.delivery_terms,
          p_estimated_fulfilment: parsed.data.estimated_fulfilment || null,
          p_valid_days: parsed.data.valid_days,
        })
      : await db.rpc('rnx_submit_commercial_quote', {
          p_offer_id: parsed.data.offer_id,
          p_supplier_id: supplier.id,
          p_title: parsed.data.title,
          p_scope_description: parsed.data.scope_description,
          p_total_amount: parsed.data.total_amount,
          p_currency: parsed.data.currency,
          p_delivery_terms: parsed.data.delivery_terms,
          p_estimated_fulfilment: parsed.data.estimated_fulfilment || null,
          p_valid_days: parsed.data.valid_days,
        });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; quote_id?: string; quote_reference?: string; valid_until?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Quotation submission was rejected.' }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, quote: result, message: `Quotation ${result.quote_reference || ''} sent to the customer.` }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier] Commercial quote submission failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The quotation could not be submitted. Confirm migrations 024 and 028 are applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const parsed = withdrawSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid quotation to withdraw.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const { data, error } = await supabaseAdmin().rpc('rnx_withdraw_commercial_quote', {
      p_quote_id: parsed.data.quote_id,
      p_supplier_id: supplier.id,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; quote_reference?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Quotation withdrawal was rejected.' }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, message: `Quotation ${result.quote_reference || ''} withdrawn.` }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier] Commercial quote withdrawal failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The quotation could not be withdrawn. Confirm migrations 024 and 028 are applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
