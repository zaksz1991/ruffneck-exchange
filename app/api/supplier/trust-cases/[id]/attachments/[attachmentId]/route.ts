import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { createTrustCaseEvidenceDownload } from '@/lib/trust-case-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, context: Context) {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  const { id, attachmentId } = await context.params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(attachmentId)) return NextResponse.json({ error: 'Invalid evidence reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id')
      .eq('id', id).eq('supplier_application_id', supplier.id).not('supplier_response_requested_at', 'is', null).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'This case is not assigned to your supplier account.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data: attachment, error } = await db.from('rnx_trust_case_attachments')
      .select('id,storage_path,file_name').eq('id', attachmentId).eq('trust_case_id', id).eq('visibility', 'customer').maybeSingle();
    if (error) throw error;
    if (!attachment) return NextResponse.json({ error: 'Evidence file not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const url = await createTrustCaseEvidenceDownload(db, attachment);
    return new NextResponse(null, { status: 302, headers: { ...PRIVATE_HEADERS, Location: url } });
  } catch (error) {
    console.error('[RNX supplier trust evidence] Download failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The evidence file could not be opened.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
