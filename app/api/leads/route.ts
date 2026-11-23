import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { currentCustomerId, createTrackingToken, hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';
import { hasAnalyticsConsent } from '@/lib/analytics-consent';
import { trackingUrl } from '@/lib/notifications';

export const runtime = 'nodejs';
const schema = z.object({
  request_type: z.enum(['product', 'service', 'bulk', 'partnership', 'other']),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  phone: z.string().trim().min(7).max(30),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  category: z.string().trim().min(2).max(100),
  details: z.string().trim().min(30).max(4000),
  listing_slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  preferred_contact: z.enum(['phone', 'whatsapp', 'email']),
  attribution_source: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_medium: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_campaign: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_referrer_host: z.string().trim().max(120).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_landing_path: z.string().trim().max(180).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  consent: z.literal('yes')
});

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Some details are missing or invalid. Review the form and try again.', issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 });
  try {
    const db = supabaseAdmin();
    let referencedListing: { id: string; slug: string; title: string; supplierName: string } | null = null;
    if (parsed.data.listing_slug) {
      const { data: listing, error: listingError } = await db.from('rnx_listings')
        .select('id,slug,title,supplier:rnx_supplier_applications!inner(business_name,status,public_slug)')
        .eq('slug', parsed.data.listing_slug)
        .eq('status', 'approved')
        .eq('supplier.status', 'approved')
        .not('supplier.public_slug', 'is', null)
        .maybeSingle();
      if (listingError) {
        console.error('[RNX] Referenced offer lookup failed:', { code: listingError.code, message: listingError.message });
        return NextResponse.json({ error: 'The referenced offer could not be checked. Please try again.' }, { status: 503 });
      }
      if (!listing) return NextResponse.json({ error: 'The offer you selected is no longer published. Refresh the offer page or submit a general sourcing request.' }, { status: 409 });
      const supplier = Array.isArray(listing.supplier) ? listing.supplier[0] : listing.supplier;
      if (!supplier?.business_name || supplier.status !== 'approved' || !supplier.public_slug) {
        return NextResponse.json({ error: 'The selected offer is no longer available for enquiry. Submit a general sourcing request instead.' }, { status: 409 });
      }
      referencedListing = { id: listing.id, slug: listing.slug, title: listing.title, supplierName: supplier.business_name };
    }
    const trackingToken = createTrackingToken();
    const customerId = await currentCustomerId();
    const analyticsAllowed = await hasAnalyticsConsent();
    // Keep one stable, fully typed shape whether consent is granted or not.
    // The capture timestamp is generated server-side and is not part of the form schema.
    const attribution = {
      attribution_source: analyticsAllowed ? parsed.data.attribution_source || null : null,
      attribution_medium: analyticsAllowed ? parsed.data.attribution_medium || null : null,
      attribution_campaign: analyticsAllowed ? parsed.data.attribution_campaign || null : null,
      attribution_referrer_host: analyticsAllowed ? parsed.data.attribution_referrer_host || null : null,
      attribution_landing_path: analyticsAllowed ? parsed.data.attribution_landing_path || null : null,
      attribution_captured_at: analyticsAllowed ? new Date().toISOString() : null,
    };
    const { attribution_source, attribution_medium, attribution_campaign, attribution_referrer_host, attribution_landing_path, listing_slug, ...leadFields } = parsed.data;
    void listing_slug; // The slug is transport context only; its verified database snapshot is stored below.
    const { data: lead, error } = await db.from('rnx_leads').insert({
      ...leadFields, ...attribution, email: parsed.data.email || null, city: parsed.data.city || null,
      referenced_listing_id: referencedListing?.id ?? null,
      referenced_listing_slug: referencedListing?.slug ?? null,
      referenced_listing_title: referencedListing?.title ?? null,
      referenced_supplier_name: referencedListing?.supplierName ?? null,
      customer_id: customerId, tracking_token_hash: hashTrackingToken(trackingToken),
      status: 'new', contact_release_status: 'locked', last_activity_at: new Date().toISOString()
    }).select('id').single();
    if (error || !lead) {
      console.error('[RNX] Lead insert failed:', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'We could not save your request right now. Please try again later.' }, { status: 503 });
    }
    if (analyticsAllowed) {
      const { error: eventError } = await db.from('rnx_events').insert({
        event_type: 'lead_submitted', path: '/request', state: parsed.data.state, category: parsed.data.category,
        consented: true, source: attribution.attribution_source || null, medium: attribution.attribution_medium || null,
        campaign: attribution.attribution_campaign || null, referrer_host: attribution.attribution_referrer_host || null,
        event_data: { request_type: parsed.data.request_type },
      });
      if (eventError) console.error('[RNX analytics] Consented lead event could not be recorded:', eventError.message);
    }
    const url = trackingUrl(trackingToken);
    if (parsed.data.email) {
      await queueNotification(db, {
        recipientEmail: parsed.data.email,
        subject: `RuffNeck Exchange request received — ${lead.id.slice(0, 8)}`,
        bodyText: `We received your ${parsed.data.category} request. Our operations team will review it.${referencedListing ? `\n\nPublished offer referenced: ${referencedListing.title} — ${referencedListing.supplierName}. This is an enquiry reference, not confirmation of stock, pricing or supplier acceptance.` : ''}\n\nUse this private link to follow updates and message RNX: ${url}\n\nKeep this link private. It grants access to this request. Your contact details are not released to a supplier without an authorised introduction.`,
        relatedLeadId: lead.id
      });
    }
    const operationsEmail = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (operationsEmail) {
      await queueNotification(db, { recipientEmail: operationsEmail, subject: `New RNX customer request: ${parsed.data.category}`, bodyText: `A new customer request was submitted.\nReference: ${lead.id}\nCategory: ${parsed.data.category}\nLocation: ${[parsed.data.city, parsed.data.state].filter(Boolean).join(', ')}${referencedListing ? `\nPublished offer: ${referencedListing.title} — ${referencedListing.supplierName}` : ''}\nReview it in the RNX operations console.`, relatedLeadId: lead.id });
    }
    return NextResponse.json({ ok: true, id: lead.id, trackingUrl: url, message: 'Request received. Save your private tracking link to follow updates and message RNX.' }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX] Lead endpoint unavailable:', error instanceof Error ? error.message : 'Unknown server error');
    return NextResponse.json({ error: 'Customer request submission is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
