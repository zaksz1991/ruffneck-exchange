import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ leadId: z.string().uuid() });

type Listing = {
  id: string; supplier_application_id: string; title: string; listing_type: string;
  category: string; state: string; city: string | null; keywords: string[] | null;
};
type Supplier = {
  id: string; business_name: string; category: string; state: string; business_type: string | null;
};

type Candidate = {
  supplierId: string;
  businessName: string;
  category: string;
  state: string;
  score: number;
  reasons: string[];
  listings: Array<{ title: string; listingType: string; category: string; state: string; city: string | null }>;
};

function normalise(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(value: unknown): string[] {
  const ignored = new Set(['and','the','for','with','from','near','best','other','general','service','services','product','products']);
  return normalise(value).split(/\s+/).filter((word) => word.length > 2 && !ignored.has(word));
}
function overlap(left: unknown, right: unknown): number {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const item of a) if (b.has(item)) matches++;
  return matches / Math.max(1, Math.min(a.size, b.size));
}
function typeAligned(requestType: string, listingType: string): boolean {
  const type = normalise(requestType);
  const listing = normalise(listingType);
  if (type === 'product') return listing === 'product' || listing === 'wholesale';
  if (type === 'service') return listing === 'service';
  if (type === 'bulk') return listing === 'wholesale' || listing === 'rental';
  if (type === 'partnership') return listing === 'wholesale' || listing === 'service';
  return true;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:write')) return NextResponse.json({ error: 'You do not have permission to prepare supplier matches.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid customer request.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const [{ data: lead, error: leadError }, { data: suppliers, error: supplierError }, { data: listings, error: listingError }, { data: previousOffers, error: offersError }] = await Promise.all([
      db.from('rnx_leads').select('id,category,state,city,request_type,status,contact_release_status').eq('id', parsed.data.leadId).maybeSingle(),
      db.from('rnx_supplier_applications').select('id,business_name,category,state,business_type').eq('status', 'approved').order('business_name', { ascending: true }).limit(500),
      db.from('rnx_listings').select('id,supplier_application_id,title,listing_type,category,state,city,keywords').eq('status', 'approved').limit(1500),
      db.from('rnx_lead_offers').select('supplier_application_id').eq('lead_id', parsed.data.leadId).limit(1000),
    ]);
    if (leadError || !lead) return NextResponse.json({ error: 'Customer request not found.' }, { status: 404 });
    if (!['qualified', 'matched'].includes(lead.status)) return NextResponse.json({ error: 'Qualify the customer request before requesting supplier recommendations.' }, { status: 409 });
    if (lead.contact_release_status === 'released') return NextResponse.json({ error: 'This request has already had customer contact released.' }, { status: 409 });
    if (supplierError || listingError || offersError) throw supplierError || listingError || offersError;

    const offered = new Set((previousOffers || []).map((row: { supplier_application_id: string }) => row.supplier_application_id));
    const approvedSupplierIds = new Set((suppliers || []).map((row: Supplier) => row.id));
    const supplierListings = new Map<string, Listing[]>();
    for (const listing of (listings || []) as Listing[]) {
      if (!approvedSupplierIds.has(listing.supplier_application_id)) continue;
      const current = supplierListings.get(listing.supplier_application_id) || [];
      current.push(listing);
      supplierListings.set(listing.supplier_application_id, current);
    }

    const leadCategory = normalise(lead.category);
    const leadState = normalise(lead.state);
    const leadCity = normalise(lead.city);
    const candidates: Candidate[] = [];

    for (const supplier of (suppliers || []) as Supplier[]) {
      if (offered.has(supplier.id)) continue;
      const reasons: string[] = [];
      let score = 0;
      const supplierCategory = normalise(supplier.category);
      const supplierBusinessType = normalise(supplier.business_type);
      const supplierCategoryExact = Boolean(leadCategory && supplierCategory === leadCategory);
      const supplierCategoryOverlap = Math.max(overlap(lead.category, supplier.category), overlap(lead.category, supplier.business_type));
      if (supplierCategoryExact) { score += 48; reasons.push('Exact supplier-category match'); }
      else if (supplierCategoryOverlap >= 0.5) { score += 26; reasons.push('Related supplier category'); }
      else if (supplierCategoryOverlap >= 0.25) { score += 14; reasons.push('Partial category overlap'); }

      const supplierStateMatch = Boolean(leadState && normalise(supplier.state) === leadState);
      if (supplierStateMatch) { score += 18; reasons.push('Supplier registered in the requested state'); }

      const supplierListingRows = supplierListings.get(supplier.id) || [];
      const scoredListings = supplierListingRows.map((listing) => {
        const categoryExact = Boolean(leadCategory && normalise(listing.category) === leadCategory);
        const categoryOverlap = overlap(lead.category, listing.category);
        const keywordOverlap = (listing.keywords || []).filter((keyword) => overlap(lead.category, keyword) > 0 || tokens(lead.category).some((token) => tokens(keyword).includes(token))).length;
        const listingStateMatch = Boolean(leadState && normalise(listing.state) === leadState);
        const listingCityMatch = Boolean(leadCity && normalise(listing.city) === leadCity);
        const aligned = typeAligned(lead.request_type, listing.listing_type);
        let points = categoryExact ? 34 : categoryOverlap >= 0.5 ? 20 : categoryOverlap >= 0.25 ? 10 : 0;
        points += Math.min(10, keywordOverlap * 3);
        if (listingStateMatch) points += 14;
        if (listingCityMatch) points += 6;
        if (aligned) points += 4;
        return { listing, points, categoryExact, categoryOverlap, listingStateMatch, listingCityMatch, aligned };
      }).sort((a, b) => b.points - a.points);

      const best = scoredListings[0];
      if (best) {
        score += best.points;
        if (best.categoryExact) reasons.push('Approved listing in the exact request category');
        else if (best.categoryOverlap >= 0.25) reasons.push('Approved listing in a related category');
        if (best.listingStateMatch) reasons.push('Approved listing located in the requested state');
        if (best.listingCityMatch) reasons.push('Approved listing located in the requested city');
        if (best.aligned) reasons.push('Listing type fits the request type');
      }

      score = Math.min(100, score);
      // A recommendation must have at least a meaningful category signal or an exact listing match.
      const hasCategorySignal = supplierCategoryOverlap >= 0.25 || Boolean(best && best.categoryOverlap >= 0.25);
      if (score < 25 || !hasCategorySignal) continue;
      candidates.push({
        supplierId: supplier.id,
        businessName: supplier.business_name,
        category: supplier.category,
        state: supplier.state,
        score,
        reasons: [...new Set(reasons)],
        listings: scoredListings.slice(0, 3).filter((item) => item.points > 0).map(({ listing }) => ({
          title: listing.title, listingType: listing.listing_type, category: listing.category,
          state: listing.state, city: listing.city || null,
        })),
      });
    }
    candidates.sort((a, b) => b.score - a.score || a.businessName.localeCompare(b.businessName));
    return NextResponse.json({
      matches: candidates.slice(0, 20),
      totalMatches: candidates.length,
      excludedPreviouslyOffered: offered.size,
      method: 'rule_based',
      note: 'Recommendations use supplier category, approved catalogue and stated location. They do not verify stock, capacity, licences, prices, delivery or current availability. RNX must review each match before creating an offer.',
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX matching] Recommendation request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Supplier recommendations are temporarily unavailable. Confirm RNX migrations 001–006 and Supabase server credentials.' }, { status: 503 });
  }
}
