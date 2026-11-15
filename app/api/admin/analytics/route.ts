import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LeadRow = { id: string; status: string; contact_release_status: string; created_at: string; state: string; category: string; attribution_source: string | null; attribution_medium: string | null; attribution_campaign: string | null };
type SupplierRow = { id: string; status: string; created_at: string; state: string; category: string; attribution_source: string | null; attribution_medium: string | null; attribution_campaign: string | null };
type OfferRow = { id: string; created_at: string; payment_status: string; payment_amount: number | null; currency: string; payment_verified_at: string | null; contact_released_at: string | null };
type EventRow = { event_type: string; source: string | null; medium: string | null; campaign: string | null; state: string | null; category: string | null; created_at: string };

function key(value: string | null | undefined) { return (value || 'Unattributed').trim() || 'Unattributed'; }
function increment(map: Map<string, number>, name: string) { map.set(name, (map.get(name) || 0) + 1); }
function sorted(map: Map<string, number>, limit = 12) { return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit); }

export async function GET(request: Request) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'analytics:read')) return NextResponse.json({ error: 'You do not have permission to view analytics.' }, { status: 403 });
  const url = new URL(request.url);
  const rawDays = Number(url.searchParams.get('days') || '30');
  const days = [7, 30, 90, 365].includes(rawDays) ? rawDays : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const db = supabaseAdmin();
    const [leadsRes, suppliersRes, offersRes, eventsRes] = await Promise.all([
      db.from('rnx_leads').select('id,status,contact_release_status,created_at,state,category,attribution_source,attribution_medium,attribution_campaign').gte('created_at', since).order('created_at', { ascending: true }).limit(5000),
      db.from('rnx_supplier_applications').select('id,status,created_at,state,category,attribution_source,attribution_medium,attribution_campaign').gte('created_at', since).order('created_at', { ascending: true }).limit(5000),
      db.from('rnx_lead_offers').select('id,created_at,payment_status,payment_amount,currency,payment_verified_at,contact_released_at').or(`created_at.gte.${since},payment_verified_at.gte.${since},contact_released_at.gte.${since}`).order('created_at', { ascending: true }).limit(5000),
      db.from('rnx_events').select('event_type,source,medium,campaign,state,category,created_at').eq('consented', true).gte('created_at', since).order('created_at', { ascending: true }).limit(5000),
    ]);
    const failure = leadsRes.error || suppliersRes.error || offersRes.error || eventsRes.error;
    if (failure) {
      console.error('[RNX analytics] Query failed:', { code: failure.code, message: failure.message });
      return NextResponse.json({ error: 'Analytics could not be loaded. Confirm migration 008 and server-side database credentials are configured.' }, { status: 503 });
    }
    const leads = (leadsRes.data || []) as LeadRow[];
    const suppliers = (suppliersRes.data || []) as SupplierRow[];
    const offers = (offersRes.data || []) as OfferRow[];
    const events = (eventsRes.data || []) as EventRow[];

    const sourceLeads = new Map<string, number>();
    const sourceQualified = new Map<string, number>();
    const sourceReleased = new Map<string, number>();
    const sourceSuppliers = new Map<string, number>();
    const campaigns = new Map<string, number>();
    const categories = new Map<string, number>();
    const states = new Map<string, number>();
    const daily = new Map<string, { leads: number; suppliers: number; introductions: number }>();
    const dayEntry = (date: string) => { const day = daily.get(date) || { leads: 0, suppliers: 0, introductions: 0 }; daily.set(date, day); return day; };

    for (const lead of leads) {
      const source = key(lead.attribution_source);
      increment(sourceLeads, source);
      if (['qualified', 'matched'].includes(lead.status)) increment(sourceQualified, source);
      if (lead.contact_release_status === 'released') increment(sourceReleased, source);
      increment(categories, key(lead.category));
      increment(states, key(lead.state));
      dayEntry(lead.created_at.slice(0, 10)).leads += 1;
      if (lead.attribution_campaign) increment(campaigns, lead.attribution_campaign);
    }
    for (const supplier of suppliers) {
      increment(sourceSuppliers, key(supplier.attribution_source));
      dayEntry(supplier.created_at.slice(0, 10)).suppliers += 1;
      if (supplier.attribution_campaign) increment(campaigns, supplier.attribution_campaign);
    }
    for (const offer of offers) {
      if (offer.contact_released_at) dayEntry(offer.contact_released_at.slice(0, 10)).introductions += 1;
    }
    const verifiedOffers = offers.filter((offer) => offer.payment_status === 'paid' && Boolean(offer.payment_verified_at) && offer.payment_verified_at! >= since);
    const verifiedLeadFeeValueByCurrency = verifiedOffers.reduce((totals, offer) => {
      const currency = (offer.currency || 'NGN').toUpperCase();
      totals[currency] = (totals[currency] || 0) + Number(offer.payment_amount || 0);
      return totals;
    }, {} as Record<string, number>);
    for (const currency of Object.keys(verifiedLeadFeeValueByCurrency)) verifiedLeadFeeValueByCurrency[currency] = Math.round(verifiedLeadFeeValueByCurrency[currency] * 100) / 100;
    const eventCounts = new Map<string, number>();
    for (const event of events) increment(eventCounts, event.event_type);

    const report = {
      days, since,
      totals: {
        leads: leads.length,
        qualifiedLeads: leads.filter((lead) => ['qualified', 'matched'].includes(lead.status)).length,
        openLeads: leads.filter((lead) => !['closed', 'invalid'].includes(lead.status)).length,
        attributedLeads: leads.filter((lead) => Boolean(lead.attribution_source)).length,
        supplierApplications: suppliers.length,
        approvedSuppliers: suppliers.filter((supplier) => supplier.status === 'approved').length,
        attributedSupplierApplications: suppliers.filter((supplier) => Boolean(supplier.attribution_source)).length,
        supplierOffers: offers.filter((offer) => offer.created_at >= since).length,
        verifiedLeadFeePayments: verifiedOffers.length,
        verifiedLeadFeeValueByCurrency,
        introductionsReleased: offers.filter((offer) => Boolean(offer.contact_released_at) && offer.contact_released_at! >= since).length,
        consentedConversionEvents: events.length,
      },
      sources: [...new Set([...sourceLeads.keys(), ...sourceSuppliers.keys()])].map((source) => ({
        source,
        leads: sourceLeads.get(source) || 0,
        qualifiedLeads: sourceQualified.get(source) || 0,
        introductions: sourceReleased.get(source) || 0,
        supplierApplications: sourceSuppliers.get(source) || 0,
      })).sort((a, b) => b.leads + b.supplierApplications - (a.leads + a.supplierApplications)),
      campaigns: sorted(campaigns),
      categories: sorted(categories),
      states: sorted(states),
      daily: [...daily.entries()].map(([date, values]) => ({ date, ...values })).sort((a, b) => a.date.localeCompare(b.date)),
      consentedEvents: sorted(eventCounts),
      limitations: ['This report measures submitted requests and supplier applications, not total website traffic.', 'Attribution appears only when a visitor explicitly accepts optional analytics.', 'Direct and unattributed submissions are included in operational totals, but no campaign is inferred for them.', 'The report contains aggregates only and does not return customer or supplier personal details.', 'Source-table introductions represent the selected request cohort and may be released after the report period; the headline introduction count uses the actual release date.'],
      capped: leads.length === 5000 || suppliers.length === 5000 || offers.length === 5000 || events.length === 5000,
    };
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX analytics] Endpoint failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Analytics service is temporarily unavailable.' }, { status: 503 });
  }
}
