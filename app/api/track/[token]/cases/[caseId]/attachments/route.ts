import { NextResponse } from 'next/server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { uploadTrustCaseEvidence } from '@/lib/trust-case-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ token: string; caseId: string }> };

async function getCustomerCase(token: string, caseId: string) {
  if (!/^[a-f0-9]{64}$/i.test(token) || !UUID_PATTERN.test(caseId)) return null;
  const db = supabaseAdmin();
  const { data: lead, error: leadError } = await db.from('rnx_leads').select('id').eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
  if (leadError || !lead) return null;
  const { data: trustCase, error } = await db.from('rnx_trust_cases').select('id,case_reference,lead_id,status').eq('id', caseId).eq('lead_id', lead.id).maybeSingle();
  if (error || !trustCase) return null;
  return { db, lead, trustCase };
}

export async function GET(_request: Request, context: Context) {
  try {
    const { token, caseId } = await context.params;
    const access = await getCustomerCase(token, caseId);
    if (!access) return NextResponse.json({ error: 'Case not found for this private tracking link.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data, error } = await access.db.from('rnx_trust_case_attachments')
      .select('id,trust_case_id,uploader_role,visibility,file_name,mime_type,file_size_bytes,note,created_at')
      .eq('trust_case_id', caseId).eq('visibility', 'customer').order('created_at', { ascending: true }).limit(20);
    if (error) throw error;
    return NextResponse.json({ attachments: data || [] }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer trust evidence] List failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Case evidence could not be loaded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  try {
    const { token, caseId } = await context.params;
    const access = await getCustomerCase(token, caseId);
    if (!access) return NextResponse.json({ error: 'Case not found for this private tracking link.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (['resolved', 'closed'].includes(access.trustCase.status)) {
      return NextResponse.json({ error: 'This case is resolved or closed. Contact RNX Operations through the request message thread if new information must be considered.' }, { status: 409, headers: PRIVATE_HEADERS });
    }
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF or image evidence file.' }, { status: 400, headers: PRIVATE_HEADERS });
    const result = await uploadTrustCaseEvidence(access.db, {
      caseId,
      uploaderRole: 'customer',
      file,
      note: String(form.get('note') || ''),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, attachment: result.attachment }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX customer trust evidence] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Evidence could not be uploaded. Confirm migration 030 and private Storage are ready.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
