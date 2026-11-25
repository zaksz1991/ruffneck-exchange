import { NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET() {
  const customerId = await currentCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to view your supplier introductions.' }, { status: 401, headers: PRIVATE_HEADERS });

  try {
    const db = supabaseAdmin();
    const { error: expiryError } = await db.rpc('rnx_expire_commercial_quotes');
    if (expiryError) throw expiryError;
    const { data, error } = await db
      .from('rnx_lead_offers')
      .select('id,lead_id,anonymised_summary,payment_status,payment_verified_at,customer_approved_at,contact_released_at,created_at,supplier_application_id,supplier:rnx_supplier_applications!inner(business_name,public_slug),lead:rnx_leads!inner(id,category,state,city,customer_id),outcome:rnx_transaction_outcomes(id,status,customer_outcome,supplier_outcome,customer_confirmed_at,supplier_confirmed_at,completed_at),review:rnx_supplier_reviews(id,rating,title,body,moderation_status,created_at)')
      .eq('lead.customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const rows = data ?? [];
    const offerIds = rows.map((row: any) => row.id);
    let quoteRows: any[] = [];
    if (offerIds.length) {
      const { data: quotes, error: quotesError } = await db.from('rnx_commercial_quotes')
        .select('id,lead_offer_id,quote_reference,title,scope_description,total_amount,currency,delivery_terms,estimated_fulfilment,valid_until,status,created_at,responded_at,revision_of_quote_id,revision_request_note,revision_requested_at')
        .in('lead_offer_id', offerIds)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (quotesError) throw quotesError;
      quoteRows = quotes ?? [];
    }

    const offers = rows.map((row: any) => {
      const lead = one(row.lead);
      const supplier = one(row.supplier);
      const outcome = one(row.outcome);
      const review = one(row.review);
      const contactReleased = Boolean(row.contact_released_at && row.payment_status === 'paid' && row.payment_verified_at && row.customer_approved_at);
      return {
        id: row.id,
        lead_id: row.lead_id,
        anonymised_summary: row.anonymised_summary,
        payment_status: row.payment_status,
        contact_released: contactReleased,
        created_at: row.created_at,
        category: lead?.category ?? '',
        state: lead?.state ?? '',
        city: lead?.city ?? null,
        supplier: contactReleased && supplier ? {
          business_name: supplier.business_name,
          profile_url: supplier.public_slug ? `/suppliers/${encodeURIComponent(supplier.public_slug)}` : null,
        } : null,
        outcome: outcome ? {
          status: outcome.status,
          customer_outcome: outcome.customer_outcome,
          supplier_outcome: outcome.supplier_outcome,
          customer_confirmed_at: outcome.customer_confirmed_at,
          supplier_confirmed_at: outcome.supplier_confirmed_at,
          completed_at: outcome.completed_at,
        } : null,
        review: review ? {
          id: review.id,
          rating: review.rating,
          title: review.title,
          body: review.body,
          moderation_status: review.moderation_status,
          created_at: review.created_at,
        } : null,
        can_confirm_outcome: contactReleased && Boolean(lead?.customer_id),
        quotes: quoteRows.filter((quote) => quote.lead_offer_id === row.id),
      };
    });

    return NextResponse.json({ offers }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer] Introductions could not be loaded:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your supplier introductions could not be loaded. Confirm migrations 023 and 024 are applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
