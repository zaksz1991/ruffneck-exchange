import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { isSameOriginRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const requirements: Record<string, string[]> = {
  registered_business: ['business_registration','proof_of_address'],
  sole_trader: ['business_evidence','proof_of_address'],
  licensed_provider: ['business_registration','operating_license','proof_of_address'],
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { verificationId?: string } | null;
  if (!body?.verificationId || !/^[0-9a-f-]{36}$/i.test(body.verificationId)) return NextResponse.json({ error: 'Invalid verification reference.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: record, error } = await db.from('rnx_supplier_verifications').select('id,status,verification_type')
      .eq('id', body.verificationId).eq('supplier_application_id', supplier.id).maybeSingle();
    if (error || !record) return NextResponse.json({ error: 'Verification draft not found.' }, { status: 404 });
    if (record.status !== 'draft') return NextResponse.json({ error: 'This verification is no longer an editable draft.' }, { status: 409 });
    const { data: documents, error: docError } = await db.from('rnx_supplier_verification_documents').select('document_type')
      .eq('verification_id', record.id).eq('supplier_application_id', supplier.id);
    if (docError) throw docError;
    const present = new Set((documents || []).map((doc) => doc.document_type));
    const missing = (requirements[record.verification_type] || []).filter((type) => !present.has(type));
    if (missing.length) return NextResponse.json({ error: `Upload the required evidence before submitting: ${missing.map((x) => x.replaceAll('_',' ')).join(', ')}.` }, { status: 400 });
    const now = new Date().toISOString();
    const { error: updateError } = await db.from('rnx_supplier_verifications').update({ status: 'submitted', submitted_at: now, updated_at: now }).eq('id', record.id).eq('status', 'draft');
    if (updateError) throw updateError;
    await db.from('rnx_supplier_applications').update({ verification_status: 'submitted', verification_expires_at: null }).eq('id', supplier.id);
    await db.from('rnx_supplier_verification_events').insert({ verification_id: record.id, actor_role: 'supplier', actor_supplier_id: supplier.id, actor_email: supplier.email, event_type: 'verification_submitted', details: { document_count: documents?.length || 0 } });
    return NextResponse.json({ ok: true, message: 'Verification submitted. RNX will review the declarations and evidence. Your profile is not verified until the review is approved.' });
  } catch (error) {
    console.error('[RNX supplier verification] Submit failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Verification submission could not be completed.' }, { status: 503 });
  }
}
