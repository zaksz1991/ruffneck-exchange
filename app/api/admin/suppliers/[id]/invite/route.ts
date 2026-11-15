import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { site } from '@/lib/site';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:write')) return NextResponse.json({ error: 'You do not have permission to activate supplier portals.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid supplier.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: supplier, error: lookupError } = await db.from('rnx_supplier_applications').select('id,business_name,status')
      .eq('id', id).maybeSingle();
    if (lookupError || !supplier) return NextResponse.json({ error: 'Supplier record not found.' }, { status: 404 });
    if (supplier.status !== 'approved') return NextResponse.json({ error: 'Only approved suppliers can receive a portal activation link.' }, { status: 409 });
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { error } = await db.from('rnx_supplier_applications').update({ portal_invite_token_hash: tokenHash, portal_invite_expires_at: expiresAt }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Supplier activation link could not be generated.' }, { status: 503 });
    await db.from('rnx_admin_audit_log').insert({ action: 'supplier_portal_invite_created', entity_type: 'supplier', entity_id: id, details: { expires_at: expiresAt } });
    await recordStaffActivity(db, actor, 'supplier_portal_invitation_created', 'supplier', id, { expires_at: expiresAt });
    const url = new URL('/supplier/claim', site.url);
    url.searchParams.set('token', token);
    return NextResponse.json({ ok: true, url: url.toString(), expiresAt }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier invite]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Supplier activation is temporarily unavailable.' }, { status: 503 });
  }
}
