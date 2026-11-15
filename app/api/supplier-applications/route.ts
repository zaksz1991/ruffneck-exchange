import { NextResponse } from 'next/server';
import { hasAnalyticsConsent } from '@/lib/analytics-consent';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { slugify } from '@/lib/site';
import { hashSupplierPassword } from '@/lib/supplier-auth';

export const runtime = 'nodejs';
const schema = z.object({
  business_name: z.string().trim().min(2).max(180),
  contact_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  portal_password: z.string().min(10, 'Use at least 10 characters for your supplier portal password.').max(100),
  phone: z.string().trim().min(7).max(30),
  business_type: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(60),
  website: z.union([z.string().trim().url().max(300), z.literal('')]).optional(),
  description: z.string().trim().min(30).max(3000),
  first_listing_title: z.string().trim().max(180).optional().or(z.literal('')),
  first_listing_type: z.enum(['product', 'service', 'wholesale', 'rental']).optional(),
  first_listing_price_type: z.enum(['enquiry', 'fixed', 'from']).optional(),
  first_listing_price: z.string().trim().max(20).optional().or(z.literal('')),
  first_listing_description: z.string().trim().max(3000).optional().or(z.literal('')),
  attribution_source: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_medium: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_campaign: z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_referrer_host: z.string().trim().max(120).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  attribution_landing_path: z.string().trim().max(180).regex(/^[a-zA-Z0-9 _.:/-]+$/).refine((value) => !/[0-9]{7,}/.test(value) && !value.includes('@')).optional(),
  consent: z.literal('yes')
}).superRefine((data, ctx) => {
  const hasTitle = Boolean(data.first_listing_title?.trim());
  const hasDescription = Boolean(data.first_listing_description?.trim());
  if (hasTitle && (!data.first_listing_description || data.first_listing_description.trim().length < 30)) {
    ctx.addIssue({ code: 'custom', path: ['first_listing_description'], message: 'Describe the offer in at least 30 characters.' });
  }
  if (!hasTitle && hasDescription) {
    ctx.addIssue({ code: 'custom', path: ['first_listing_title'], message: 'Enter a listing title or clear the offer description.' });
  }
  if (data.first_listing_price_type !== 'enquiry' && hasTitle) {
    const price = Number(data.first_listing_price);
    if (!data.first_listing_price || !Number.isFinite(price) || price <= 0) {
      ctx.addIssue({ code: 'custom', path: ['first_listing_price'], message: 'Enter a positive price for fixed or from pricing.' });
    }
  }
});

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Some business or listing details are missing or invalid. Review the form and try again.', issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 });

  const values = parsed.data;
  try {
    const db = supabaseAdmin();
    const analyticsAllowed = await hasAnalyticsConsent();
    const attribution = analyticsAllowed ? {
      attribution_source: values.attribution_source || null,
      attribution_medium: values.attribution_medium || null,
      attribution_campaign: values.attribution_campaign || null,
      attribution_referrer_host: values.attribution_referrer_host || null,
      attribution_landing_path: values.attribution_landing_path || null,
      attribution_captured_at: new Date().toISOString(),
    } : {};
    const normalizedEmail = values.email.toLowerCase();
    const { data: existing } = await db.from('rnx_supplier_applications').select('id,status').eq('email', normalizedEmail).in('status', ['pending','approved']).limit(1).maybeSingle();
    if (existing) return NextResponse.json({ error: 'An application already exists for this business email. Contact RNX operations for account assistance.' }, { status: 409 });
    const publicSlug = `${slugify(values.business_name) || 'business'}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: application, error } = await db.from('rnx_supplier_applications').insert({
      ...attribution,
      business_name: values.business_name,
      contact_name: values.contact_name,
      email: values.email.toLowerCase(),
      phone: values.phone,
      portal_password_hash: hashSupplierPassword(values.portal_password),
      portal_enabled: false,
      business_type: values.business_type,
      category: values.category,
      state: values.state,
      website: values.website || null,
      description: values.description,
      consent: values.consent,
      public_slug: publicSlug,
      status: 'pending'
    }).select('id').single();

    if (error || !application) {
      console.error('[RNX] Supplier application insert failed:', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'We could not save the application right now. Please try again later.' }, { status: 503 });
    }

    let listingSubmitted: boolean | null = null;
    if (values.first_listing_title) {
      listingSubmitted = false;
      const listingSlug = `${slugify(values.first_listing_title) || 'offer'}-${Date.now().toString(36)}`;
      const { error: listingError } = await db.from('rnx_listings').insert({
        supplier_application_id: application.id,
        title: values.first_listing_title,
        slug: listingSlug,
        listing_type: values.first_listing_type ?? 'product',
        category: values.category,
        description: values.first_listing_description,
        state: values.state,
        price_type: values.first_listing_price_type ?? 'enquiry',
        price: values.first_listing_price ? Number(values.first_listing_price) : null,
        currency: 'NGN',
        status: 'pending'
      });
      if (listingError) {
        console.error('[RNX] Initial listing insert failed:', { code: listingError.code, message: listingError.message, applicationId: application.id });
      } else {
        listingSubmitted = true;
      }
    }

    if (analyticsAllowed) {
      const { error: eventError } = await db.from('rnx_events').insert({
        event_type: 'supplier_application_submitted', path: '/supplier', state: values.state, category: values.category,
        consented: true, source: attribution.attribution_source || null, medium: attribution.attribution_medium || null,
        campaign: attribution.attribution_campaign || null, referrer_host: attribution.attribution_referrer_host || null,
        event_data: { listing_submitted: listingSubmitted === true },
      });
      if (eventError) console.error('[RNX analytics] Consented supplier event could not be recorded:', eventError.message);
    }
    return NextResponse.json({ ok: true, listingSubmitted, message: 'Application received for review.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX] Supplier endpoint unavailable:', error instanceof Error ? error.message : 'Unknown server error');
    return NextResponse.json({ error: 'Business application submission is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
