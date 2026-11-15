import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'verification:read')) return NextResponse.json({ error: 'You do not have permission to view supplier verification.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from('rnx_supplier_verifications')
      .select('id,supplier_application_id,verification_type,registered_business_name,registration_number,country,operating_state,status,submitted_at,reviewed_at,verification_expires_at,created_at,updated_at,supplier:rnx_supplier_applications!inner(business_name,email,phone,status,category,state)')
      .in('status', ['submitted','under_review','verified','rejected','expired'])
      .order('submitted_at', { ascending: true }).limit(250);
    if (error) throw error;
    const ids = (data || []).map((row) => row.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: docs, error: docsError } = await db.from('rnx_supplier_verification_documents').select('verification_id,review_status').in('verification_id', ids);
      if (docsError) throw docsError;
      for (const doc of docs || []) counts[doc.verification_id] = (counts[doc.verification_id] || 0) + 1;
    }
    return NextResponse.json({ verifications: (data || []).map((row) => ({ ...row, document_count: counts[row.id] || 0 })) }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin verification] Queue failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Supplier verification queue could not be loaded. Confirm migration 011 is applied.' }, { status: 503 });
  }
}
