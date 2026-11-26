import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { createTrustCaseEvidenceDownload } from '@/lib/trust-case-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
type Context = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  if (!hasPermission(actor.role, 'trust:read')) return NextResponse.json({ error: 'You do not have permission to download trust evidence.' }, { status: 403, headers: PRIVATE_HEADERS });
  const { id, attachmentId } = await context.params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(attachmentId)) return NextResponse.json({ error: 'Invalid evidence reference.' }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: attachment, error } = await db.from('rnx_trust_case_attachments')
      .select('id,storage_path,file_name').eq('id', attachmentId).eq('trust_case_id', id).maybeSingle();
    if (error) throw error;
    if (!attachment) return NextResponse.json({ error: 'Evidence file not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const url = await createTrustCaseEvidenceDownload(db, attachment);
    return new NextResponse(null, { status: 302, headers: { ...PRIVATE_HEADERS, Location: url } });
  } catch (error) {
    console.error('[RNX admin trust evidence] Download failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The evidence file could not be opened.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
