import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { ensureSupplierVerificationBucket } from '@/lib/verification-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({
  verificationType: z.enum(['registered_business','sole_trader','licensed_provider']),
  registeredBusinessName: z.string().trim().min(2).max(180),
  registrationNumber: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().min(2).max(80).default('Nigeria'),
  operatingState: z.string().trim().min(2).max(80),
  website: z.string().trim().url().max(300).optional().or(z.literal('')),
  supplierStatement: z.string().trim().min(20).max(1800),
  declarationAccepted: z.literal(true),
});

export async function GET() {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  try {
    const db = supabaseAdmin();
    await ensureSupplierVerificationBucket(db);
    const { data: request, error } = await db.from('rnx_supplier_verifications').select('id,verification_type,registered_business_name,registration_number,country,operating_state,website,supplier_statement,status,supplier_message,submitted_at,reviewed_at,verification_expires_at,created_at,updated_at')
      .eq('supplier_application_id', supplier.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    let verificationStatus = supplier.verification_status || 'unverified';
    if (request?.status === 'verified' && request.verification_expires_at && new Date(request.verification_expires_at).getTime() <= Date.now()) {
      const expiredAt = new Date().toISOString();
      await db.from('rnx_supplier_verifications').update({ status: 'expired', updated_at: expiredAt }).eq('id', request.id).eq('status', 'verified');
      await db.from('rnx_supplier_applications').update({ verification_status: 'expired' }).eq('id', supplier.id);
      await db.from('rnx_supplier_verification_events').insert({ verification_id: request.id, actor_role: 'system', event_type: 'verification_expired', details: { expired_at: expiredAt } });
      request.status = 'expired';
      verificationStatus = 'expired';
    }
    let documents: Array<Record<string, unknown>> = [];
    if (request) {
      const { data, error: docsError } = await db.from('rnx_supplier_verification_documents').select('id,document_type,original_file_name,mime_type,file_size_bytes,review_status,reviewed_at,created_at,storage_path')
        .eq('verification_id', request.id).eq('supplier_application_id', supplier.id).order('created_at', { ascending: true });
      if (docsError) throw docsError;
      documents = await Promise.all((data || []).map(async (doc) => {
        const { data: signed } = await db.storage.from('rnx-supplier-verification').createSignedUrl(String(doc.storage_path), 300);
        const { storage_path: _storagePath, ...safeDoc } = doc;
        return { ...safeDoc, signedUrl: signed?.signedUrl || null };
      }));
    }
    return NextResponse.json({ request, documents, supplierVerificationStatus: verificationStatus }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX supplier verification] Load failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Verification information is temporarily unavailable. Confirm migration 011 is applied.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the verification details and declaration.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: active, error: activeError } = await db.from('rnx_supplier_verifications').select('id,status')
      .eq('supplier_application_id', supplier.id).in('status', ['draft','submitted','under_review']).maybeSingle();
    if (activeError) throw activeError;
    if (active && active.status !== 'draft') return NextResponse.json({ error: 'A verification submission is already being reviewed. Wait for the review outcome before starting another.' }, { status: 409 });
    const input = parsed.data;
    const values = {
      verification_type: input.verificationType,
      registered_business_name: input.registeredBusinessName,
      registration_number: input.registrationNumber || null,
      country: input.country,
      operating_state: input.operatingState,
      website: input.website || null,
      supplier_statement: input.supplierStatement,
      declaration_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const saved = active
      ? await db.from('rnx_supplier_verifications').update(values).eq('id', active.id).eq('supplier_application_id', supplier.id).select('id,status').single()
      : await db.from('rnx_supplier_verifications').insert({ ...values, supplier_application_id: supplier.id, status: 'draft' }).select('id,status').single();
    if (saved.error || !saved.data) throw saved.error || new Error('Verification draft was not saved.');
    await db.from('rnx_supplier_applications').update({ verification_status: 'draft', verification_expires_at: null }).eq('id', supplier.id);
    await db.from('rnx_supplier_verification_events').insert({ verification_id: saved.data.id, actor_role: 'supplier', actor_supplier_id: supplier.id, actor_email: supplier.email, event_type: active ? 'draft_updated' : 'draft_created', details: { verification_type: input.verificationType } });
    return NextResponse.json({ ok: true, requestId: saved.data.id, message: 'Verification draft saved. Upload the required evidence, then submit it for review.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX supplier verification] Save failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Verification details could not be saved.' }, { status: 503 });
  }
}
