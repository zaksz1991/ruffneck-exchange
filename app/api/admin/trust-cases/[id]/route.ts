import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  status: z.enum(['new','triaged','awaiting_customer','awaiting_supplier','under_review','resolved','closed']).optional(),
  severity: z.enum(['low','normal','high','critical']).optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  publicResolution: z.string().trim().max(1800).nullable().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'Choose at least one case field to update.' });

const transitions: Record<string, string[]> = {
  new: ['triaged','awaiting_customer','under_review','closed'],
  triaged: ['awaiting_customer','awaiting_supplier','under_review','resolved','closed'],
  awaiting_customer: ['awaiting_supplier','under_review','resolved','closed'],
  awaiting_supplier: ['awaiting_customer','under_review','resolved','closed'],
  under_review: ['awaiting_customer','awaiting_supplier','resolved','closed'],
  resolved: ['under_review','closed'],
  closed: ['under_review'],
};

export async function GET(_request: Request, context: Context) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:read')) return NextResponse.json({ error: 'You do not have permission to view trust cases.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const [caseResult, messagesResult, eventsResult] = await Promise.all([
      db.from('rnx_trust_cases').select('*,lead:rnx_leads!inner(id,name,email,phone,category,state,city,status,created_at),supplier:rnx_supplier_applications(business_name,status,category,state),assigned:rnx_staff_users(id,full_name,email,role)').eq('id', id).maybeSingle(),
      db.from('rnx_trust_case_messages').select('id,sender_role,sender_staff_id,sender_name,visibility,body,created_at').eq('trust_case_id', id).order('created_at', { ascending: true }).limit(200),
      db.from('rnx_trust_case_events').select('id,actor_role,actor_email,event_type,from_status,to_status,details,created_at').eq('trust_case_id', id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (caseResult.error || !caseResult.data) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404 });
    if (messagesResult.error) throw messagesResult.error;
    if (eventsResult.error) throw eventsResult.error;
    return NextResponse.json({ case: caseResult.data, messages: messagesResult.data || [], events: eventsResult.data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX trust cases] Case detail failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Case details could not be loaded.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'trust:write')) return NextResponse.json({ error: 'You do not have permission to update trust cases.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid case update.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data: before, error: lookupError } = await db.from('rnx_trust_cases').select('id,case_reference,status,severity,assigned_staff_id,public_resolution').eq('id', id).maybeSingle();
    if (lookupError || !before) return NextResponse.json({ error: 'Trust case not found.' }, { status: 404 });
    const input = parsed.data;
    if (input.status && input.status !== before.status && !transitions[before.status]?.includes(input.status)) {
      return NextResponse.json({ error: `This case cannot move from ${before.status} to ${input.status}.` }, { status: 409 });
    }
    const nextResolution = input.publicResolution !== undefined ? input.publicResolution : before.public_resolution;
    if (['resolved','closed'].includes(input.status || '') && !String(nextResolution || '').trim()) {
      return NextResponse.json({ error: 'Add a customer-visible outcome summary before resolving or closing the case.' }, { status: 400 });
    }
    if (input.assignedStaffId) {
      const { data: staff, error } = await db.from('rnx_staff_users').select('id,status').eq('id', input.assignedStaffId).maybeSingle();
      if (error || !staff || staff.status !== 'active') return NextResponse.json({ error: 'Choose an active staff account for assignment.' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (input.status !== undefined) {
      update.status = input.status;
      if (input.status === 'resolved') update.resolved_at = now;
      if (input.status === 'closed') update.closed_at = now;
      if (input.status === 'under_review') { update.resolved_at = null; update.closed_at = null; }
    }
    if (input.severity !== undefined) update.severity = input.severity;
    if (input.assignedStaffId !== undefined) update.assigned_staff_id = input.assignedStaffId;
    if (input.publicResolution !== undefined) update.public_resolution = input.publicResolution || null;
    const { data: saved, error } = await db.from('rnx_trust_cases').update(update).eq('id', id).eq('status', before.status).select('id,case_reference,status,severity,assigned_staff_id,public_resolution,updated_at,resolved_at,closed_at').maybeSingle();
    if (error) throw error;
    if (!saved) return NextResponse.json({ error: 'Another staff member changed this case. Refresh the case before trying again.' }, { status: 409 });

    await db.from('rnx_trust_case_events').insert({
      trust_case_id: id, actor_role: 'staff', actor_staff_id: actor.id, actor_email: actor.email,
      event_type: input.status && input.status !== before.status ? 'status_changed' : 'case_updated',
      from_status: before.status, to_status: saved.status,
      details: { severity: saved.severity, assigned_staff_id: saved.assigned_staff_id, public_resolution_updated: input.publicResolution !== undefined },
    });
    await recordStaffActivity(db, actor, 'trust_case_updated', 'trust_case', id, { case_reference: before.case_reference, from_status: before.status, to_status: saved.status, severity: saved.severity, assigned_staff_id: saved.assigned_staff_id });
    return NextResponse.json({ ok: true, case: saved }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX trust cases] Case update failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The case could not be updated.' }, { status: 503 });
  }
}
