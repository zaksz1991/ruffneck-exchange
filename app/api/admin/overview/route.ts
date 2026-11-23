import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:read')) return NextResponse.json({ error: 'You do not have permission to view the operations console.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [suppliersResult, approvedResult, listingsResult, leadsResult, offersResult] = await Promise.all([
      db.from('rnx_supplier_applications').select('id,business_name,contact_name,email,phone,business_type,category,state,status,created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
      db.from('rnx_supplier_applications').select('id,business_name,category,state,status').eq('status', 'approved').order('business_name', { ascending: true }).limit(300),
      db.from('rnx_listings').select('id,title,listing_type,category,state,status,created_at,supplier:rnx_supplier_applications!inner(business_name,status)').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
      db.from('rnx_leads').select('id,request_type,name,email,phone,state,city,category,details,referenced_listing_id,referenced_listing_slug,referenced_listing_title,referenced_supplier_name,preferred_contact,status,contact_release_status,created_at').not('status', 'in', '(closed,invalid)').order('created_at', { ascending: false }).limit(50),
      db.from('rnx_lead_offers').select('id,lead_id,supplier_application_id,anonymised_summary,quoted_fee,currency,payment_status,payment_reference,payment_amount,supplier_accepted_at,supplier_declined_at,payment_verified_at,customer_approved_at,customer_declined_at,contact_released_at,customer_approval_token_expires_at,created_at,supplier:rnx_supplier_applications!inner(business_name),lead:rnx_leads!inner(name,phone,email,category,state,city)').order('created_at', { ascending: false }).limit(100),
    ]);
    const error = suppliersResult.error || approvedResult.error || listingsResult.error || leadsResult.error || offersResult.error;
    if (error) {
      console.error('[RNX admin] Overview query failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Operations data could not be loaded. Confirm migrations 001–004 and Supabase server credentials.' }, { status: 503 });
    }
    return NextResponse.json({
      suppliers: suppliersResult.data ?? [], approvedSuppliers: approvedResult.data ?? [],
      listings: listingsResult.data ?? [], leads: leadsResult.data ?? [], offers: offersResult.data ?? [],
      counts: {
        suppliers: suppliersResult.data?.length ?? 0,
        listings: listingsResult.data?.length ?? 0,
        leads: leadsResult.data?.length ?? 0,
        offers: offersResult.data?.length ?? 0,
      },
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin] Overview unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Operations service is temporarily unavailable.' }, { status: 503 });
  }
}
