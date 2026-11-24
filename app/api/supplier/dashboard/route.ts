import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { signedListingImageUrl } from '@/lib/listing-image-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  try {
    const db = supabaseAdmin();
    const [listingsResult, membershipsResult, offersResult, plansResult] = await Promise.all([
      db.from('rnx_listings').select('id,title,slug,listing_type,category,description,state,city,price_type,price,currency,keywords,status,image_path,created_at,updated_at')
        .eq('supplier_application_id', supplier.id).order('created_at', { ascending: false }).limit(250),
      db.from('rnx_membership_subscriptions').select('id,status,quoted_amount,currency,billing_interval,quote_expires_at,period_start,period_end,created_at,plan:rnx_membership_plans!inner(code,name,description,listing_limit,display_price,features),payments:rnx_membership_payments(id,amount,currency,payment_method,transaction_reference,status,supplier_note,verified_at,created_at)')
        .eq('supplier_application_id', supplier.id).order('created_at', { ascending: false }).limit(20),
      db.from('rnx_lead_offers').select('id,anonymised_summary,quoted_fee,currency,payment_status,supplier_accepted_at,payment_verified_at,customer_approved_at,customer_declined_at,supplier_declined_at,supplier_response_note,contact_released_at,created_at,lead:rnx_leads!inner(id,name,email,phone,category,state,city,details,preferred_contact)')
        .eq('supplier_application_id', supplier.id).order('created_at', { ascending: false }).limit(50),
      db.from('rnx_membership_plans').select('id,code,name,description,listing_limit,display_price,features,sort_order').eq('active', true).order('sort_order', { ascending: true }),
    ]);
    const error = listingsResult.error || membershipsResult.error || offersResult.error || plansResult.error;
    if (error) {
      console.error('[RNX supplier dashboard]', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Supplier information could not be loaded. Confirm the cumulative RNX migrations are applied.' }, { status: 503 });
    }
    const listings = await Promise.all((listingsResult.data ?? []).map(async (row: any) => ({
      ...row,
      image_url: await signedListingImageUrl(db, row.image_path),
    })));
    const offers = (offersResult.data ?? []).map((row: any) => {
      const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
      const released = Boolean(row.contact_released_at && row.payment_status === 'paid' && row.payment_verified_at && row.customer_approved_at);
      return {
        id: row.id,
        anonymised_summary: row.anonymised_summary,
        quoted_fee: row.quoted_fee,
        currency: row.currency,
        payment_status: row.payment_status,
        supplier_accepted_at: row.supplier_accepted_at,
        supplier_declined_at: row.supplier_declined_at,
        supplier_response_note: row.supplier_response_note,
        payment_verified_at: row.payment_verified_at,
        customer_approved_at: row.customer_approved_at,
        customer_declined_at: row.customer_declined_at,
        contact_released_at: row.contact_released_at,
        created_at: row.created_at,
        customer: {
          category: lead?.category ?? '',
          state: lead?.state ?? '',
          city: lead?.city ?? null,
          contact_released: released,
          name: released ? lead?.name ?? null : null,
          email: released ? lead?.email ?? null : null,
          phone: released ? lead?.phone ?? null : null,
          preferred_contact: released ? lead?.preferred_contact ?? null : null,
          request_details: released ? lead?.details ?? null : null,
        },
      };
    });
    return NextResponse.json({
      supplier,
      listings,
      memberships: membershipsResult.data ?? [],
      offers,
      plans: plansResult.data ?? [],
      paymentInstructions: process.env.RNX_PAYMENT_INSTRUCTIONS?.trim() || 'RNX operations will provide verified payment instructions after issuing a quotation. Do not transfer funds to an unverified account or person.',
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier dashboard]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Supplier portal is temporarily unavailable.' }, { status: 503 });
  }
}
