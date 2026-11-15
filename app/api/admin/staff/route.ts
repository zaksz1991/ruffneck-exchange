import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { hashOpaqueToken } from '@/lib/staff-credentials';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['owner','operations_admin','finance','support','analyst']),
});

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'staff:manage')) return NextResponse.json({ error: 'Only an RNX owner can manage staff accounts.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [staff, invitations, activity] = await Promise.all([
      db.from('rnx_staff_users').select('id,email,full_name,role,status,last_login_at,created_at').order('created_at', { ascending: false }).limit(200),
      db.from('rnx_staff_invitations').select('id,email,role,expires_at,accepted_at,revoked_at,created_at').order('created_at', { ascending: false }).limit(100),
      db.from('rnx_staff_activity').select('id,actor_email,actor_role,event_type,entity_type,entity_id,details,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    const error = staff.error || invitations.error || activity.error;
    if (error) {
      console.error('[RNX staff management] Read failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Staff records could not be loaded. Confirm migration 009 is applied.' }, { status: 503 });
    }
    return NextResponse.json({ staff: staff.data || [], invitations: invitations.data || [], activity: activity.data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX staff management] Read unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Staff management is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'staff:manage')) return NextResponse.json({ error: 'Only an RNX owner can invite staff.' }, { status: 403 });
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid staff email and role.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  try {
    const db = supabaseAdmin();
    const { data: existing } = await db.from('rnx_staff_users').select('id').eq('email', email).maybeSingle();
    if (existing) return NextResponse.json({ error: 'A staff account already uses this email address.' }, { status: 409 });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const rawToken = randomBytes(32).toString('hex');
    const { error: revokeError } = await db.from('rnx_staff_invitations').update({ revoked_at: now.toISOString() }).eq('email', email).is('accepted_at', null).is('revoked_at', null);
    if (revokeError) throw revokeError;
    const { data: invite, error } = await db.from('rnx_staff_invitations').insert({
      email, role: parsed.data.role, token_hash: hashOpaqueToken(rawToken),
      created_by: actor.id, expires_at: expiresAt,
    }).select('id').single();
    if (error || !invite) throw error || new Error('Invitation was not created.');
    await recordStaffActivity(db, actor, 'staff_invitation_created', 'staff_invitation', invite.id, { invited_email: email, role: parsed.data.role, expires_at: expiresAt });
    const url = new URL('/admin/accept-invite', site.url);
    url.searchParams.set('token', rawToken);
    return NextResponse.json({ ok: true, invitationUrl: url.toString(), expiresAt }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX staff management] Invitation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The invitation could not be created. Confirm migration 009 is applied.' }, { status: 503 });
  }
}
