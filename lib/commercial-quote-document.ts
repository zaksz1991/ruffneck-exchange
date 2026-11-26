import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-server';

export type CommercialQuoteDocumentAudience = 'customer' | 'supplier';

export type CommercialQuoteDocumentData = {
  quote: {
    id: string;
    quote_reference: string;
    title: string;
    scope_description: string;
    total_amount: number;
    currency: string;
    delivery_terms: string;
    estimated_fulfilment: string | null;
    valid_until: string;
    status: string;
    created_at: string;
  };
  customer: { name: string };
  supplier: { business_name: string; category: string; state: string; public_slug: string | null };
  request: { category: string; state: string; city: string | null };
};

/**
 * Loads a print-ready commercial quotation only for one of its recorded participants.
 * The introduction's payment, supplier acceptance, customer approval and contact-release
 * gates are rechecked here because this loader uses the server-only service-role client.
 */
export async function loadCommercialQuoteDocument(
  quoteId: string,
  audience: CommercialQuoteDocumentAudience,
  participantId: string,
): Promise<CommercialQuoteDocumentData | null> {
  const db = supabaseAdmin();
  const { error: expiryError } = await db.rpc('rnx_expire_commercial_quotes');
  if (expiryError) throw expiryError;

  const ownerColumn = audience === 'customer' ? 'customer_id' : 'supplier_application_id';
  const { data: quote, error: quoteError } = await db
    .from('rnx_commercial_quotes')
    .select('id,quote_reference,lead_offer_id,lead_id,customer_id,supplier_application_id,title,scope_description,total_amount,currency,delivery_terms,estimated_fulfilment,valid_until,status,created_at')
    .eq('id', quoteId)
    .eq(ownerColumn, participantId)
    .maybeSingle();
  if (quoteError) throw quoteError;
  if (!quote) return null;

  const [offerResult, leadResult, customerResult, supplierResult] = await Promise.all([
    db.from('rnx_lead_offers')
      .select('id,lead_id,supplier_application_id,payment_status,payment_verified_at,supplier_accepted_at,customer_approved_at,contact_released_at')
      .eq('id', quote.lead_offer_id)
      .eq('lead_id', quote.lead_id)
      .eq('supplier_application_id', quote.supplier_application_id)
      .maybeSingle(),
    db.from('rnx_leads')
      .select('id,customer_id,category,state,city')
      .eq('id', quote.lead_id)
      .eq('customer_id', quote.customer_id)
      .maybeSingle(),
    db.from('rnx_customers')
      .select('id,name,status')
      .eq('id', quote.customer_id)
      .eq('status', 'active')
      .maybeSingle(),
    db.from('rnx_supplier_applications')
      .select('id,business_name,category,state,public_slug,status,portal_enabled')
      .eq('id', quote.supplier_application_id)
      .eq('status', 'approved')
      .eq('portal_enabled', true)
      .maybeSingle(),
  ]);

  if (offerResult.error) throw offerResult.error;
  if (leadResult.error) throw leadResult.error;
  if (customerResult.error) throw customerResult.error;
  if (supplierResult.error) throw supplierResult.error;

  const offer = offerResult.data;
  const lead = leadResult.data;
  const customer = customerResult.data;
  const supplier = supplierResult.data;
  const introductionReleased = Boolean(
    offer && lead && customer && supplier &&
    offer.payment_status === 'paid' &&
    offer.payment_verified_at &&
    offer.supplier_accepted_at &&
    offer.customer_approved_at &&
    offer.contact_released_at,
  );
  if (!introductionReleased || !customer || !supplier || !lead) return null;

  return {
    quote: {
      id: quote.id,
      quote_reference: quote.quote_reference,
      title: quote.title,
      scope_description: quote.scope_description,
      total_amount: Number(quote.total_amount),
      currency: quote.currency,
      delivery_terms: quote.delivery_terms,
      estimated_fulfilment: quote.estimated_fulfilment,
      valid_until: quote.valid_until,
      status: quote.status,
      created_at: quote.created_at,
    },
    customer: { name: customer.name },
    supplier: {
      business_name: supplier.business_name,
      category: supplier.category,
      state: supplier.state,
      public_slug: supplier.public_slug,
    },
    request: {
      category: lead.category,
      state: lead.state,
      city: lead.city,
    },
  };
}
