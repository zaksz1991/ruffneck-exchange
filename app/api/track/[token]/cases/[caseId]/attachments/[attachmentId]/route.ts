import { NextResponse } from 'next/server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { createTrustCaseEvidenceDownload } from '@/lib/trust-case-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ token: string; caseId: string; attachmentId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { token, caseId, attachmentId } = await context.params;
    if (!/^[a-f0-9]{64}$/i.test(token) || !UUID_PATTERN.test(caseId) || !UUID_PATTERN.test(attachmentId)) {
      return NextResponse.json({ error: 'Invalid evidence reference.' }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const db = supabaseAdmin();
    const { data: lead, error: leadError } = await db.from('rnx_leads').select('id').eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
    if (leadError || !lead) return NextResponse.json({ error: 'Tracking link not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data: attachment, error } = await db.from('rnx_trust_case_attachments')
      .select('id,storage_path,file_name,visibility')
      .eq('id', attachmentId).eq('trust_case_id', caseId).eq('visibility', 'customer').maybeSingle();
    if (error) throw error;
    if (!attachment) return NextResponse.json({ error: 'Evidence file not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id').eq('id', caseId).eq('lead_id', lead.id).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'Evidence file not found for this request.' }, { status: 404, headers: PRIVATE_HEADERS });
    const url = await createTrustCaseEvidenceDownload(db, attachment);
    return new NextResponse(null, { status: 302, headers: { ...PRIVATE_HEADERS, Location: url } });
  } catch (error) {
    console.error('[RNX customer trust evidence] Download failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The evidence file could not be opened.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
