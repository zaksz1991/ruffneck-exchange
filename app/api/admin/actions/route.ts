import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';

export const runtime = 'nodejs';
const schema = z.object({
  resource: z.enum(['supplier', 'listing', 'lead']),
  id: z.string().uuid(),
  status: z.string().min(2).max(20),
});

async function audit(db: ReturnType<typeof supabaseAdmin>, resource: string, id: string, status: string) {
  const { error } = await db.from('rnx_admin_audit_log').insert({ action: `set_${status}`, entity_type: resource, entity_id: id, details: { status } });
  if (error) console.error('[RNX admin] Audit write failed:', { code: error.code, message: error.message });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:write')) return NextResponse.json({ error: 'You do not have permission to change marketplace records.' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid operation.' }, { status: 400 });

  const { resource, id, status } = parsed.data;
  const allowed: Record<string, string[]> = {
    supplier: ['approved', 'rejected'],
    listing: ['approved', 'rejected'],
    lead: ['new', 'qualifying', 'qualified', 'matched', 'closed', 'invalid'],
  };
  if (!allowed[resource].includes(status)) return NextResponse.json({ error: 'That status change is not permitted.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    if (resource === 'listing' && status === 'approved') {
      const { data: listing, error: listingError } = await db.from('rnx_listings').select('id,supplier:rnx_supplier_applications!inner(status)').eq('id', id).maybeSingle();
      if (listingError || !listing) return NextResponse.json({ error: 'Listing was not found.' }, { status: 404 });
      const supplier = listing.supplier as unknown as { status: string };
      if (supplier.status !== 'approved') return NextResponse.json({ error: 'Approve the supplier application before approving its listing.' }, { status: 409 });
    }

    const table = resource === 'supplier' ? 'rnx_supplier_applications' : resource === 'listing' ? 'rnx_listings' : 'rnx_leads';
    const updatePayload = resource === 'listing' ? { status, updated_at: new Date().toISOString() } : { status };
    const { data, error } = await db.from(table).update(updatePayload).eq('id', id).select('id').maybeSingle();
    if (error) {
      console.error('[RNX admin] Update failed:', { resource, code: error.code, message: error.message });
      return NextResponse.json({ error: 'The record could not be updated.' }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    await audit(db, resource, id, status);
    await recordStaffActivity(db, actor, 'marketplace_record_status_changed', resource, id, { status });
    return NextResponse.json({ ok: true, message: `${resource} status updated to ${status}.` });
  } catch (error) {
    console.error('[RNX admin] Action unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The operation service is temporarily unavailable.' }, { status: 503 });
  }
}
