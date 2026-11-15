import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
const schema = z.object({
  role: z.enum(['owner','operations_admin','finance','support','analyst']).optional(),
  status: z.enum(['active','suspended']).optional(),
}).refine((value) => Boolean(value.role || value.status));

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'staff:manage')) return NextResponse.json({ error: 'Only an RNX owner can change staff access.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid staff account.' }, { status: 400 });
  if (actor.id === id) return NextResponse.json({ error: 'You cannot change your own role or account status.' }, { status: 409 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid role or account status.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: before, error: lookupError } = await db.from('rnx_staff_users').select('id,email,role,status').eq('id', id).maybeSingle();
    if (lookupError || !before) return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 });
    const { data: updated, error } = await db.from('rnx_staff_users').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select('id,email,full_name,role,status,last_login_at,created_at').maybeSingle();
    if (error) {
      const isLastOwner = error.code === '23514' || /last active staff owner/i.test(error.message || '');
      return NextResponse.json({ error: isLastOwner ? 'The last active owner cannot be demoted or suspended.' : 'Staff access could not be updated.' }, { status: 409 });
    }
    if (!updated) return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 });
    await recordStaffActivity(db, actor, 'staff_access_updated', 'staff_user', id, { previous_role: before.role, previous_status: before.status, next_role: updated.role, next_status: updated.status });
    return NextResponse.json({ ok: true, staff: updated });
  } catch (error) {
    console.error('[RNX staff management] Update failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Staff access is temporarily unavailable.' }, { status: 503 });
  }
}
