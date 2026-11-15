import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { slugify } from '@/lib/site';

export const runtime = 'nodejs';
const schema = z.object({
  title: z.string().trim().min(3).max(180),
  listing_type: z.enum(['product','service','wholesale','rental']),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().min(30).max(3000),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  price_type: z.enum(['enquiry','fixed','from']),
  price: z.string().trim().max(20).optional().or(z.literal('')),
  keywords: z.string().trim().max(500).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.price_type !== 'enquiry') {
    const price = Number(value.price);
    if (!value.price || !Number.isFinite(price) || price <= 0) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a positive price for fixed/from pricing.' });
  }
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Review the listing details.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: membership, error: membershipError } = await db.from('rnx_membership_subscriptions')
      .select('id,plan:rnx_membership_plans!inner(listing_limit)')
      .eq('supplier_application_id', supplier.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ error: 'An active supplier membership is required before adding catalogue listings.' }, { status: 409 });
    const membershipPlan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;
    const limit = Number(membershipPlan?.listing_limit ?? 0);
    const { count, error: countError } = await db.from('rnx_listings').select('id', { count: 'exact', head: true })
      .eq('supplier_application_id', supplier.id).in('status', ['pending','approved','paused']);
    if (countError) return NextResponse.json({ error: 'The catalogue limit could not be checked.' }, { status: 503 });
    if ((count ?? 0) >= limit) return NextResponse.json({ error: `Your current membership allows ${limit} catalogue listings. Request a plan upgrade to add more.` }, { status: 409 });

    const values = parsed.data;
    const slug = `${slugify(values.title) || 'offer'}-${randomBytes(3).toString('hex')}`;
    const keywords = (values.keywords ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    const { data, error } = await db.from('rnx_listings').insert({
      supplier_application_id: supplier.id,
      title: values.title,
      slug,
      listing_type: values.listing_type,
      category: values.category,
      description: values.description,
      state: values.state,
      city: values.city || null,
      price_type: values.price_type,
      price: values.price ? Number(values.price) : null,
      currency: 'NGN',
      keywords,
      status: 'pending',
    }).select('id,title,status').single();
    if (error || !data) {
      console.error('[RNX supplier listings]', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'The listing could not be submitted. Confirm migration 002 is applied.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, listing: data, message: 'Listing submitted. It remains private until RNX approves both your business and this offer.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX supplier listings]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Catalogue submission is temporarily unavailable.' }, { status: 503 });
  }
}
