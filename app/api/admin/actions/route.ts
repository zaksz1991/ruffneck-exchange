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
  const { error } = await db.from('rnx_admin_audit_log').insert({
    action: `set_${status}`,
    entity_type: resource,
    entity_id: id,
    details: { status },
  });
  if (error) console.error('[RNX admin] Audit write failed:', { code: error.code, message: error.message });
}

function databaseFailure(resource: string, status: string, error: { code?: string; message?: string }) {
  const code = String(error.code ?? '');
  const message = String(error.message ?? '');

  // Migration 013 deliberately blocks a new supplier approval until the
  // applicant has confirmed ownership of the application email address.
  // Supabase reports an unqualified PL/pgSQL RAISE EXCEPTION as P0001.
  if (
    resource === 'supplier' &&
    status === 'approved' &&
    code === 'P0001' &&
    /supplier email must be confirmed before approval/i.test(message)
  ) {
    return NextResponse.json({
      error: 'Supplier approval is blocked because the applicant has not confirmed the registered business email. The applicant must open the email-confirmation link sent to that address. No supplier status was changed.',
      code: 'SUPPLIER_EMAIL_CONFIRMATION_REQUIRED',
    }, { status: 409 });
  }

  if (code === '23505') {
    return NextResponse.json({
      error: 'This change conflicts with an existing unique record. No status was changed. Check for a duplicate supplier or listing identifier.',
      code: 'RNX_DUPLICATE_RECORD',
    }, { status: 409 });
  }

  if (code === '23514' || code === 'P0001') {
    return NextResponse.json({
      error: 'The database rejected this change because an RNX business rule was not satisfied. No status was changed. Review the record requirements and the Vercel function log for the database error.',
      code: 'RNX_BUSINESS_RULE_BLOCK',
    }, { status: 409 });
  }

  if (code === '42703' || code === '42P01' || code === 'PGRST200' || code === 'PGRST204') {
    return NextResponse.json({
      error: 'The RNX database schema does not match the deployed application. No status was changed. Check the applied RNX migrations before retrying.',
      code: 'RNX_SCHEMA_MISMATCH',
    }, { status: 503 });
  }

  if (code === '42501' || code === 'PGRST301') {
    return NextResponse.json({
      error: 'The server database credentials do not have permission to update this RNX record. No status was changed. Check the server-only Supabase credentials in Vercel.',
      code: 'RNX_DATABASE_PERMISSION',
    }, { status: 503 });
  }

  return NextResponse.json({
    error: `The record could not be updated. No status was changed. Database error code: ${code || 'unavailable'}. Check the Vercel function log for the corresponding RNX admin update failure.`,
    code: 'RNX_UPDATE_FAILED',
  }, { status: 503 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'operations:write')) {
    return NextResponse.json({ error: 'You do not have permission to change marketplace records.' }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid operation.' }, { status: 400 });

  const { resource, id, status } = parsed.data;
  const allowed: Record<string, string[]> = {
    supplier: ['approved', 'rejected'],
    listing: ['approved', 'rejected'],
    lead: ['new', 'qualifying', 'qualified', 'matched', 'closed', 'invalid'],
  };
  if (!allowed[resource].includes(status)) {
    return NextResponse.json({ error: 'That status change is not permitted.' }, { status: 400 });
  }

  try {
    const db = supabaseAdmin();

    if (resource === 'listing' && status === 'approved') {
      const { data: listing, error: listingError } = await db
        .from('rnx_listings')
        .select('id,supplier:rnx_supplier_applications!inner(status)')
        .eq('id', id)
        .maybeSingle();
      if (listingError || !listing) {
        if (listingError) {
          console.error('[RNX admin] Listing precondition query failed:', { code: listingError.code, message: listingError.message });
          return databaseFailure(resource, status, listingError);
        }
        return NextResponse.json({ error: 'Listing was not found.' }, { status: 404 });
      }
      const supplier = listing.supplier as unknown as { status: string };
      if (supplier.status !== 'approved') {
        return NextResponse.json({ error: 'Approve the supplier application before approving its listing.' }, { status: 409 });
      }
    }

    const table = resource === 'supplier' ? 'rnx_supplier_applications' : resource === 'listing' ? 'rnx_listings' : 'rnx_leads';
    const updatePayload = resource === 'listing' ? { status, updated_at: new Date().toISOString() } : { status };
    const { data, error } = await db.from(table).update(updatePayload).eq('id', id).select('id').maybeSingle();

    if (error) {
      console.error('[RNX admin] Update failed:', { resource, code: error.code, message: error.message });
      return databaseFailure(resource, status, error);
    }
    if (!data) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });

    await audit(db, resource, id, status);
    await recordStaffActivity(db, actor, 'marketplace_record_status_changed', resource, id, { status });
    return NextResponse.json({ ok: true, message: `${resource} status updated to ${status}.` });
  } catch (error) {
    console.error('[RNX admin] Action unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The operation service is temporarily unavailable. No status change was confirmed.' }, { status: 503 });
  }
}
