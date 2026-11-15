import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:read')) return NextResponse.json({ error: 'You do not have permission to view trust cases.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [casesResult, staffResult] = await Promise.all([
      db.from('rnx_trust_cases').select('id,case_reference,lead_id,case_type,summary,description,requested_resolution,severity,status,public_resolution,assigned_staff_id,created_at,updated_at,resolved_at,closed_at,lead:rnx_leads!inner(id,name,email,phone,category,state,city,status,created_at),supplier:rnx_supplier_applications(business_name,status,category,state),assigned:rnx_staff_users(id,full_name,email,role)').order('updated_at', { ascending: false }).limit(150),
      db.from('rnx_staff_users').select('id,full_name,email,role').eq('status', 'active').order('full_name', { ascending: true }).limit(100),
    ]);
    if (casesResult.error) throw casesResult.error;
    if (staffResult.error) throw staffResult.error;
    return NextResponse.json({ cases: casesResult.data || [], staff: staffResult.data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX trust cases] Admin load failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Trust cases could not be loaded. Confirm migration 010 is applied.' }, { status: 503 });
  }
}
