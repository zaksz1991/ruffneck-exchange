import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { ensureSupplierVerificationBucket, SUPPLIER_VERIFICATION_BUCKET } from '@/lib/verification-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BUCKET = SUPPLIER_VERIFICATION_BUCKET;
const allowedTypes = new Set(['business_registration','proof_of_address','operating_license','business_evidence','authority_letter','tax_registration','other']);
const maxBytes = 4 * 1024 * 1024;

function detectMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function safeFilename(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100);
  return cleaned || 'evidence-file';
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  try {
    const form = await request.formData();
    const verificationId = String(form.get('verificationId') || '');
    const documentType = String(form.get('documentType') || '');
    const file = form.get('file');
    if (!/^[0-9a-f-]{36}$/i.test(verificationId) || !allowedTypes.has(documentType) || !(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a valid document type and file.' }, { status: 400 });
    }
    if (file.size < 1 || file.size > maxBytes) return NextResponse.json({ error: 'Each file must be between 1 byte and 4 MB.' }, { status: 400 });
    const db = supabaseAdmin();
    await ensureSupplierVerificationBucket(db);
    const { data: verification, error: requestError } = await db.from('rnx_supplier_verifications').select('id,status')
      .eq('id', verificationId).eq('supplier_application_id', supplier.id).maybeSingle();
    if (requestError || !verification) return NextResponse.json({ error: 'Verification draft not found.' }, { status: 404 });
    if (verification.status !== 'draft') return NextResponse.json({ error: 'Documents can only be changed while the verification is a draft.' }, { status: 409 });
    const { count, error: countError } = await db.from('rnx_supplier_verification_documents').select('id', { count: 'exact', head: true }).eq('verification_id', verificationId);
    if (countError) throw countError;
    if ((count || 0) >= 10) return NextResponse.json({ error: 'A maximum of 10 evidence files is allowed per submission.' }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const actualMime = detectMime(bytes);
    if (!actualMime || actualMime !== file.type) return NextResponse.json({ error: 'The file content does not match an allowed PDF, JPEG, PNG or WebP file.' }, { status: 415 });
    const storagePath = `${supplier.id}/${verificationId}/${randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, bytes, { contentType: actualMime, upsert: false });
    if (uploadError) throw uploadError;
    const { data: document, error: insertError } = await db.from('rnx_supplier_verification_documents').insert({
      verification_id: verificationId, supplier_application_id: supplier.id, document_type: documentType,
      original_file_name: safeFilename(file.name), storage_path: storagePath, mime_type: actualMime, file_size_bytes: bytes.byteLength,
    }).select('id,document_type,original_file_name,mime_type,file_size_bytes,review_status,created_at').single();
    if (insertError || !document) {
      await db.storage.from(BUCKET).remove([storagePath]);
      throw insertError || new Error('Evidence record could not be saved.');
    }
    await db.from('rnx_supplier_verification_events').insert({ verification_id: verificationId, actor_role: 'supplier', actor_supplier_id: supplier.id, actor_email: supplier.email, event_type: 'evidence_uploaded', details: { document_id: document.id, document_type: documentType, file_size_bytes: bytes.byteLength } });
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 300);
    return NextResponse.json({ ok: true, document: { ...document, signedUrl: signed?.signedUrl || null }, message: 'Evidence file uploaded to private storage.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX supplier verification] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Evidence upload failed. Confirm migration 011 and the private storage bucket are ready.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { documentId?: string } | null;
  if (!body?.documentId || !/^[0-9a-f-]{36}$/i.test(body.documentId)) return NextResponse.json({ error: 'Invalid document reference.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: document, error } = await db.from('rnx_supplier_verification_documents').select('id,verification_id,storage_path')
      .eq('id', body.documentId).eq('supplier_application_id', supplier.id).maybeSingle();
    if (error || !document) return NextResponse.json({ error: 'Evidence file not found.' }, { status: 404 });
    const { data: verification } = await db.from('rnx_supplier_verifications').select('status').eq('id', document.verification_id).eq('supplier_application_id', supplier.id).maybeSingle();
    if (verification?.status !== 'draft') return NextResponse.json({ error: 'Evidence can only be removed while the verification is a draft.' }, { status: 409 });
    const { error: removeError } = await db.storage.from(BUCKET).remove([document.storage_path]);
    if (removeError) throw removeError;
    const { error: deleteError } = await db.from('rnx_supplier_verification_documents').delete().eq('id', document.id).eq('supplier_application_id', supplier.id);
    if (deleteError) throw deleteError;
    await db.from('rnx_supplier_verification_events').insert({ verification_id: document.verification_id, actor_role: 'supplier', actor_supplier_id: supplier.id, actor_email: supplier.email, event_type: 'evidence_removed', details: { document_id: document.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[RNX supplier verification] Remove failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Evidence file could not be removed.' }, { status: 503 });
  }
}
