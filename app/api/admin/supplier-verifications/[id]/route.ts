import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, hasPermission, isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { recordStaffActivity } from '@/lib/staff-activity';
import { ensureSupplierVerificationBucket, SUPPLIER_VERIFICATION_BUCKET } from '@/lib/verification-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  status: z.enum(['under_review','verified','rejected','expired']),
  supplierMessage: z.string().trim().max(1800).optional().or(z.literal('')),
  internalReviewNote: z.string().trim().max(3000).optional().or(z.literal('')),
  verificationExpiresAt: z.string().datetime().optional().or(z.literal('')),
  documentReviews: z.array(z.object({ id: z.string().uuid(), status: z.enum(['accepted','rejected']), note: z.string().trim().max(1000).optional().or(z.literal('')) })).max(10).optional(),
});
const requirements: Record<string, string[]> = {
  registered_business: ['business_registration','proof_of_address'],
  sole_trader: ['business_evidence','proof_of_address'],
  licensed_provider: ['business_registration','operating_license','proof_of_address'],
};

export async function GET(_request: Request, context: Context) {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'verification:read')) return NextResponse.json({ error: 'You do not have permission to view supplier verification.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid verification reference.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    await ensureSupplierVerificationBucket(db);
    const [recordResult, docsResult, eventsResult] = await Promise.all([
      db.from('rnx_supplier_verifications').select('*,supplier:rnx_supplier_applications!inner(id,business_name,contact_name,email,phone,status,category,state,website,verification_status)').eq('id', id).maybeSingle(),
      db.from('rnx_supplier_verification_documents').select('id,verification_id,document_type,original_file_name,mime_type,file_size_bytes,review_status,review_note,reviewed_at,created_at,storage_path').eq('verification_id', id).order('created_at', { ascending: true }),
      db.from('rnx_supplier_verification_events').select('id,actor_role,actor_email,event_type,details,created_at').eq('verification_id', id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (recordResult.error || !recordResult.data) return NextResponse.json({ error: 'Verification record not found.' }, { status: 404 });
    if (docsResult.error) throw docsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const documents = await Promise.all((docsResult.data || []).map(async (doc) => {
      const { data: signed, error } = await db.storage.from(SUPPLIER_VERIFICATION_BUCKET).createSignedUrl(doc.storage_path, 300);
      return { ...doc, storage_path: undefined, signedUrl: error ? null : signed?.signedUrl || null };
    }));
    return NextResponse.json({ verification: recordResult.data, documents, events: eventsResult.data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin verification] Detail failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Verification details could not be loaded.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'verification:write')) return NextResponse.json({ error: 'You do not have permission to review supplier verification.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid verification reference.' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review details.' }, { status: 400 });
  const input = parsed.data;
  try {
    const db = supabaseAdmin();
    const { data: before, error: lookupError } = await db.from('rnx_supplier_verifications').select('id,supplier_application_id,status,verification_type').eq('id', id).maybeSingle();
    if (lookupError || !before) return NextResponse.json({ error: 'Verification record not found.' }, { status: 404 });
    if (!['submitted','under_review','verified','rejected','expired'].includes(before.status)) return NextResponse.json({ error: 'This draft is not available for staff review.' }, { status: 409 });

    if (input.documentReviews?.length && !['submitted','under_review'].includes(before.status)) {
      return NextResponse.json({ error: 'Evidence reviews are locked after a final decision.' }, { status: 409 });
    }
    if (input.documentReviews?.length) {
      for (const review of input.documentReviews) {
        const { data: document, error } = await db.from('rnx_supplier_verification_documents').select('id').eq('id', review.id).eq('verification_id', id).maybeSingle();
        if (error || !document) return NextResponse.json({ error: 'A document in this review does not belong to this verification.' }, { status: 400 });
        const { error: updateError } = await db.from('rnx_supplier_verification_documents').update({ review_status: review.status, review_note: review.note || null, reviewed_by: actor.id, reviewed_at: new Date().toISOString() }).eq('id', review.id);
        if (updateError) throw updateError;
      }
    }

    const { data: documents, error: docsError } = await db.from('rnx_supplier_verification_documents').select('document_type,review_status').eq('verification_id', id);
    if (docsError) throw docsError;
    const required = requirements[before.verification_type] || [];
    if (input.status === 'verified') {
      const accepted = new Set((documents || []).filter((doc) => doc.review_status === 'accepted').map((doc) => doc.document_type));
      const missing = required.filter((type) => !accepted.has(type));
      if (missing.length) return NextResponse.json({ error: `Cannot approve yet. Accept the required documents: ${missing.map((x) => x.replaceAll('_',' ')).join(', ')}.` }, { status: 409 });
      if (!input.verificationExpiresAt) return NextResponse.json({ error: 'Set a verification expiry date before approving.' }, { status: 400 });
      const expires = new Date(input.verificationExpiresAt);
      const now = new Date();
      const max = new Date(); max.setFullYear(max.getFullYear() + 2);
      if (!Number.isFinite(expires.getTime()) || expires <= now || expires > max) return NextResponse.json({ error: 'Expiry must be a future date within two years.' }, { status: 400 });
    }
    if (input.status === 'rejected' && String(input.supplierMessage || '').trim().length < 10) return NextResponse.json({ error: 'Provide a clear supplier-visible explanation of at least 10 characters.' }, { status: 400 });

    const now = new Date().toISOString();
    const expiry = input.status === 'verified' ? input.verificationExpiresAt! : null;
    const { data: saved, error: saveError } = await db.from('rnx_supplier_verifications').update({
      status: input.status,
      supplier_message: input.supplierMessage || null,
      internal_review_note: input.internalReviewNote || null,
      reviewer_staff_id: actor.id,
      reviewed_at: now,
      verification_expires_at: expiry,
      updated_at: now,
    }).eq('id', id).in('status', ['submitted','under_review','verified','rejected','expired'])
      .select('id,status,supplier_application_id,verification_expires_at,reviewed_at').maybeSingle();
    if (saveError) throw saveError;
    if (!saved) return NextResponse.json({ error: 'Another reviewer changed this record. Refresh before trying again.' }, { status: 409 });
    await db.from('rnx_supplier_applications').update({ verification_status: input.status, verification_expires_at: expiry, verification_last_reviewed_at: now }).eq('id', before.supplier_application_id);
    await db.from('rnx_supplier_verification_events').insert({ verification_id: id, actor_role: 'staff', actor_staff_id: actor.id, actor_email: actor.email, event_type: `verification_${input.status}`, details: { document_reviews: input.documentReviews?.length || 0, supplier_message_added: Boolean(input.supplierMessage), internal_note_added: Boolean(input.internalReviewNote), expiry } });
    await recordStaffActivity(db, actor, `supplier_verification_${input.status}`, 'supplier_verification', id, { supplier_application_id: before.supplier_application_id, status: input.status });
    return NextResponse.json({ ok: true, status: saved.status, message: `Supplier verification marked ${input.status.replaceAll('_',' ')}.` }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin verification] Review failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Verification review could not be saved.' }, { status: 503 });
  }
}
