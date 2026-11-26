import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { uploadTrustCaseEvidence } from '@/lib/trust-case-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id')
      .eq('id', id).eq('supplier_application_id', supplier.id).not('supplier_response_requested_at', 'is', null).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'This case is not assigned to your supplier account.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data, error } = await db.from('rnx_trust_case_attachments')
      .select('id,trust_case_id,uploader_role,visibility,file_name,mime_type,file_size_bytes,note,created_at')
      .eq('trust_case_id', id).eq('visibility', 'customer').order('created_at', { ascending: true }).limit(20);
    if (error) throw error;
    return NextResponse.json({ attachments: data || [] }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier trust evidence] List failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Case evidence could not be loaded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id,status,supplier_response_requested_at')
      .eq('id', id).eq('supplier_application_id', supplier.id).not('supplier_response_requested_at', 'is', null).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'This case is not assigned to your supplier account.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (trustCase.status !== 'awaiting_supplier') return NextResponse.json({ error: 'RNX must request a supplier response before your business can add case evidence.' }, { status: 409, headers: PRIVATE_HEADERS });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF or image evidence file.' }, { status: 400, headers: PRIVATE_HEADERS });
    const result = await uploadTrustCaseEvidence(db, {
      caseId: id,
      uploaderRole: 'supplier',
      uploaderSupplierId: supplier.id,
      actorEmail: supplier.email,
      file,
      note: String(form.get('note') || ''),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, attachment: result.attachment }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier trust evidence] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Evidence could not be uploaded. Confirm migration 030 and private Storage are ready.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
