import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };
const MAX_RECORDS = 250;

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  if (!hasPermission(actor.role, 'operations:read')) {
    return NextResponse.json({ error: 'You do not have permission to view commercial quotation oversight.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const db = supabaseAdmin();
    const { data: quoteRows, error: quoteError } = await db
      .from('rnx_commercial_quotes')
      .select('id,quote_reference,lead_offer_id,lead_id,supplier_application_id,title,scope_description,total_amount,currency,delivery_terms,estimated_fulfilment,valid_until,status,created_at,updated_at,responded_at,revision_of_quote_id,revision_request_note,revision_requested_at')
      .order('created_at', { ascending: false })
      .limit(MAX_RECORDS);

    if (quoteError) throw quoteError;
    const quotes = quoteRows ?? [];
    const supplierIds = [...new Set(quotes.map((quote: any) => quote.supplier_application_id).filter(Boolean))];
    const leadIds = [...new Set(quotes.map((quote: any) => quote.lead_id).filter(Boolean))];
    const quoteIds = quotes.map((quote: any) => quote.id);

    const [suppliersResult, leadsResult, eventsResult] = await Promise.all([
      supplierIds.length
        ? db.from('rnx_supplier_applications').select('id,business_name,public_slug').in('id', supplierIds)
        : Promise.resolve({ data: [], error: null } as any),
      leadIds.length
        ? db.from('rnx_leads').select('id,category,state,city').in('id', leadIds)
        : Promise.resolve({ data: [], error: null } as any),
      quoteIds.length
        ? db.from('rnx_commercial_quote_events').select('id,quote_id,actor_role,event_type,details,created_at').in('quote_id', quoteIds).order('created_at', { ascending: true }).limit(2000)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const relatedError = suppliersResult.error || leadsResult.error || eventsResult.error;
    if (relatedError) throw relatedError;

    const supplierById = new Map((suppliersResult.data ?? []).map((row: any) => [row.id, row]));
    const leadById = new Map((leadsResult.data ?? []).map((row: any) => [row.id, row]));
    const eventsByQuote = new Map<string, any[]>();
    for (const event of eventsResult.data ?? []) {
      const bucket = eventsByQuote.get(event.quote_id) ?? [];
      bucket.push({
        id: event.id,
        actor_role: event.actor_role,
        event_type: event.event_type,
        details: event.details && typeof event.details === 'object' ? event.details : {},
        created_at: event.created_at,
      });
      eventsByQuote.set(event.quote_id, bucket);
    }

    const rows = quotes.map((quote: any) => {
      const supplier = supplierById.get(quote.supplier_application_id) as any;
      const lead = leadById.get(quote.lead_id) as any;
      return {
        ...quote,
        supplier: supplier ? {
          business_name: supplier.business_name,
          public_slug: supplier.public_slug,
        } : null,
        request: lead ? {
          category: lead.category,
          state: lead.state,
          city: lead.city,
        } : null,
        events: eventsByQuote.get(quote.id) ?? [],
      };
    });

    const summary = {
      total: rows.length,
      awaitingCustomer: rows.filter((row: any) => row.status === 'submitted').length,
      preferred: rows.filter((row: any) => row.status === 'selected').length,
      declined: rows.filter((row: any) => row.status === 'declined').length,
      expired: rows.filter((row: any) => row.status === 'expired').length,
      withdrawn: rows.filter((row: any) => row.status === 'withdrawn').length,
      notSelected: rows.filter((row: any) => row.status === 'not_selected').length,
      revisionRequested: rows.filter((row: any) => row.status === 'revision_requested').length,
    };

    return NextResponse.json({ quotes: rows, summary, capped: rows.length === MAX_RECORDS }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX admin] Commercial quote oversight failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Commercial quotations could not be loaded. Confirm migration 024 and server-side Supabase credentials.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
