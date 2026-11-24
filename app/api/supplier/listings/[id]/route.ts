import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['pause', 'reactivate']) });
const updateSchema = z.object({
  action: z.literal('update'),
  title: z.string().trim().min(3).max(180),
  listing_type: z.enum(['product', 'service', 'wholesale', 'rental']),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().min(30).max(3000),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  price_type: z.enum(['enquiry', 'fixed', 'from']),
  price: z.string().trim().max(20).optional().or(z.literal('')),
  keywords: z.string().trim().max(500).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.price_type !== 'enquiry') {
    const price = Number(value.price);
    if (!value.price || !Number.isFinite(price) || price <= 0) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a positive price for fixed/from pricing.' });
    }
  }
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });

  const raw: unknown = await request.json().catch(() => null);
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  try {
    const db = supabaseAdmin();
    const { data: listing, error: lookupError } = await db.from('rnx_listings')
      .select('id,status').eq('id', id).eq('supplier_application_id', supplier.id).maybeSingle();
    if (lookupError) throw new Error('Listing lookup failed.');
    if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    if (raw && typeof raw === 'object' && (raw as { action?: unknown }).action === 'update') {
      const parsed = updateSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Review the listing details.' }, { status: 400 });
      }
      if (listing.status === 'approved') {
        return NextResponse.json({ error: 'Pause this approved listing before editing it. Approved offers cannot be changed while public.' }, { status: 409 });
      }
      if (!['pending', 'rejected', 'paused'].includes(listing.status)) {
        return NextResponse.json({ error: 'This listing cannot be edited in its current status.' }, { status: 409 });
      }

      const values = parsed.data;
      const keywords = (values.keywords ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20);
      const { data: updated, error } = await db.from('rnx_listings').update({
        title: values.title,
        listing_type: values.listing_type,
        category: values.category,
        description: values.description,
        state: values.state,
        city: values.city || null,
        price_type: values.price_type,
        price: values.price_type === 'enquiry' ? null : Number(values.price),
        keywords,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('supplier_application_id', supplier.id).eq('status', listing.status)
        .select('id,title,status,updated_at').maybeSingle();
      if (error) {
        console.error('[RNX supplier listing edit]', { code: error.code, message: error.message });
        throw new Error('Listing update failed.');
      }
      if (!updated) return NextResponse.json({ error: 'The listing changed while you were editing it. Refresh the portal and try again.' }, { status: 409 });
      try {
        const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
          action: 'supplier_listing_edited',
          entity_type: 'listing',
          entity_id: id,
          details: { supplier_application_id: supplier.id, previous_status: listing.status, new_status: 'pending', title: values.title },
        });
        if (auditError) console.error('[RNX supplier listing audit]', auditError.message);
      } catch (auditError) {
        // Audit logging is best-effort; the supplier's listing update has already succeeded.
        console.error('[RNX supplier listing audit]', auditError instanceof Error ? auditError.message : 'Audit insert failed');
      }
      return NextResponse.json({ ok: true, listing: updated, message: 'Listing changes saved and submitted for RNX review. The offer remains hidden until it is approved.' });
    }

    const parsedAction = actionSchema.safeParse(raw);
    if (!parsedAction.success) return NextResponse.json({ error: 'Choose a valid listing action.' }, { status: 400 });
    const nextStatus = parsedAction.data.action === 'pause' ? 'paused' : 'pending';
    const allowed = parsedAction.data.action === 'pause' ? listing.status === 'approved' : listing.status === 'paused';
    if (!allowed) return NextResponse.json({ error: parsedAction.data.action === 'pause'
      ? 'Only a currently approved listing can be paused.'
      : 'Only a paused listing can be submitted for re-review.' }, { status: 409 });

    const { data: updated, error } = await db.from('rnx_listings').update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id).eq('supplier_application_id', supplier.id).eq('status', listing.status)
      .select('id,status').maybeSingle();
    if (error) throw new Error('Listing status update failed.');
    if (!updated) return NextResponse.json({ error: 'The listing status changed. Refresh the portal and try again.' }, { status: 409 });
    try {
      const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
        action: parsedAction.data.action === 'pause' ? 'supplier_listing_paused' : 'supplier_listing_resubmitted',
        entity_type: 'listing',
        entity_id: id,
        details: { supplier_application_id: supplier.id, previous_status: listing.status, new_status: nextStatus },
      });
      if (auditError) console.error('[RNX supplier listing audit]', auditError.message);
    } catch (auditError) {
      // Audit logging is best-effort; the listing status change has already succeeded.
      console.error('[RNX supplier listing audit]', auditError instanceof Error ? auditError.message : 'Audit insert failed');
    }
    return NextResponse.json({ ok: true, status: nextStatus, message: nextStatus === 'paused'
      ? 'Listing paused and removed from public marketplace results.'
      : 'Listing submitted for review. It will remain hidden until RNX approves it again.' });
  } catch (error) {
    console.error('[RNX supplier listing update]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Listing could not be updated. Try again later.' }, { status: 503 });
  }
}
