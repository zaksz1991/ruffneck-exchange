import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  if (!isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin();
    const [suppliersResult, listingsResult, leadsResult] = await Promise.all([
      db.from('rnx_supplier_applications').select('id,business_name,contact_name,email,phone,business_type,category,state,status,created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
      db.from('rnx_listings').select('id,title,listing_type,category,state,status,created_at,supplier:rnx_supplier_applications!inner(business_name,status)').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
      db.from('rnx_leads').select('id,request_type,name,email,phone,state,city,category,details,preferred_contact,status,contact_release_status,created_at').not('status', 'in', '(closed,invalid)').order('created_at', { ascending: false }).limit(50),
    ]);
    const error = suppliersResult.error || listingsResult.error || leadsResult.error;
    if (error) {
      console.error('[RNX admin] Overview query failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Operations data could not be loaded. Confirm migrations 001–003 and Supabase server credentials.' }, { status: 503 });
    }
    return NextResponse.json({
      suppliers: suppliersResult.data ?? [],
      listings: listingsResult.data ?? [],
      leads: leadsResult.data ?? [],
      counts: {
        suppliers: suppliersResult.data?.length ?? 0,
        listings: listingsResult.data?.length ?? 0,
        leads: leadsResult.data?.length ?? 0,
      },
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin] Overview unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Operations service is temporarily unavailable.' }, { status: 503 });
  }
}
