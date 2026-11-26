import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { uploadTrustCaseEvidence } from '@/lib/trust-case-evidence';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  if (!hasPermission(actor.role, 'trust:read')) return NextResponse.json({ error: 'You do not have permission to view trust evidence.' }, { status: 403, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id').eq('id', id).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const { data, error } = await db.from('rnx_trust_case_attachments')
      .select('id,trust_case_id,uploader_role,visibility,file_name,mime_type,file_size_bytes,note,created_at')
      .eq('trust_case_id', id).order('created_at', { ascending: true }).limit(20);
    if (error) throw error;
    return NextResponse.json({ attachments: data || [] }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX admin trust evidence] List failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Trust evidence could not be loaded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: PRIVATE_HEADERS });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  if (!hasPermission(actor.role, 'trust:write')) return NextResponse.json({ error: 'You do not have permission to add trust evidence.' }, { status: 403, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: trustCase, error: caseError } = await db.from('rnx_trust_cases').select('id,case_reference').eq('id', id).maybeSingle();
    if (caseError || !trustCase) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const form = await request.formData();
    const file = form.get('file');
    const visibilityValue = String(form.get('visibility') || 'internal');
    if (visibilityValue !== 'customer' && visibilityValue !== 'internal') return NextResponse.json({ error: 'Choose customer-visible or internal-only evidence.' }, { status: 400, headers: PRIVATE_HEADERS });
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF or image evidence file.' }, { status: 400, headers: PRIVATE_HEADERS });
    const result = await uploadTrustCaseEvidence(db, {
      caseId: id,
      uploaderRole: 'staff',
      uploaderStaffId: actor.id,
      actorEmail: actor.email,
      visibility: visibilityValue,
      file,
      note: String(form.get('note') || ''),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    await recordStaffActivity(db, actor, 'trust_case_evidence_uploaded', 'trust_case', id, {
      case_reference: trustCase.case_reference,
      attachment_id: result.attachment.id,
      visibility: result.attachment.visibility,
      file_size_bytes: result.attachment.file_size_bytes,
    });
    return NextResponse.json({ ok: true, attachment: result.attachment }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX admin trust evidence] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Trust evidence could not be uploaded. Confirm migration 030 and private Storage are ready.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
