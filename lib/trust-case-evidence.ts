import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const TRUST_CASE_EVIDENCE_BUCKET = 'rnx-trust-case-evidence';
export const TRUST_CASE_EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
export const TRUST_CASE_EVIDENCE_MAX_FILES = 20;
export const TRUST_CASE_EVIDENCE_SIGNED_URL_SECONDS = 300;
export const TRUST_CASE_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type TrustCaseEvidenceMime = typeof TRUST_CASE_EVIDENCE_MIME_TYPES[number];
export type TrustCaseEvidenceExtension = 'pdf' | 'jpg' | 'png' | 'webp';
export type TrustCaseEvidenceUploaderRole = 'customer' | 'supplier' | 'staff';
export type TrustCaseEvidenceVisibility = 'customer' | 'internal';

export type TrustCaseEvidenceAttachment = {
  id: string;
  trust_case_id: string;
  uploader_role: TrustCaseEvidenceUploaderRole;
  visibility: TrustCaseEvidenceVisibility;
  file_name: string;
  mime_type: TrustCaseEvidenceMime;
  file_size_bytes: number;
  note: string | null;
  created_at: string;
};

export type DetectedTrustCaseEvidence = {
  mime: TrustCaseEvidenceMime;
  extension: TrustCaseEvidenceExtension;
};

export function detectTrustCaseEvidence(bytes: Uint8Array): DetectedTrustCaseEvidence | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') {
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

export function safeTrustCaseEvidenceFileName(originalName: string, extension: TrustCaseEvidenceExtension): string {
  const leaf = originalName.split(/[\\/]/).pop() || '';
  const base = leaf
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 90);
  return `${base || 'case-evidence'}.${extension}`;
}

export async function ensureTrustCaseEvidenceBucket(db: SupabaseClient): Promise<void> {
  const options = {
    public: false,
    fileSizeLimit: TRUST_CASE_EVIDENCE_MAX_BYTES,
    allowedMimeTypes: [...TRUST_CASE_EVIDENCE_MIME_TYPES],
  };
  const { data: current, error: readError } = await db.storage.getBucket(TRUST_CASE_EVIDENCE_BUCKET);
  if (current) {
    const currentTypes = [...(current.allowed_mime_types || [])].sort();
    const requiredTypes = [...options.allowedMimeTypes].sort();
    if (current.public || current.file_size_limit !== options.fileSizeLimit
      || JSON.stringify(currentTypes) !== JSON.stringify(requiredTypes)) {
      const { error } = await db.storage.updateBucket(TRUST_CASE_EVIDENCE_BUCKET, options);
      if (error) throw error;
    }
    return;
  }

  const { error: createError } = await db.storage.createBucket(TRUST_CASE_EVIDENCE_BUCKET, options);
  if (createError) {
    // A parallel first upload may create the bucket while this request is running.
    const { data: afterRace, error: retryError } = await db.storage.getBucket(TRUST_CASE_EVIDENCE_BUCKET);
    if (retryError || !afterRace) throw createError || readError || retryError || new Error('Private trust-case evidence bucket could not be created.');
    const { error: configureError } = await db.storage.updateBucket(TRUST_CASE_EVIDENCE_BUCKET, options);
    if (configureError) throw configureError;
  }
}

export async function uploadTrustCaseEvidence(
  db: SupabaseClient,
  input: {
    caseId: string;
    uploaderRole: TrustCaseEvidenceUploaderRole;
    uploaderStaffId?: string | null;
    uploaderSupplierId?: string | null;
    actorEmail?: string | null;
    visibility?: TrustCaseEvidenceVisibility;
    file: File;
    note?: string;
  },
): Promise<
  | { ok: true; attachment: TrustCaseEvidenceAttachment }
  | { ok: false; status: 400 | 409 | 413 | 415; error: string }
> {
  if (input.file.size < 1) return { ok: false, status: 400, error: 'Choose a file that is not empty.' };
  if (input.file.size > TRUST_CASE_EVIDENCE_MAX_BYTES) return { ok: false, status: 413, error: 'Each case evidence file must be 4 MB or smaller.' };

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const detected = detectTrustCaseEvidence(bytes);
  if (!detected || (input.file.type && input.file.type !== detected.mime)) {
    return { ok: false, status: 415, error: 'The file must be a genuine PDF, JPEG, PNG or WebP document.' };
  }

  const visibility = input.uploaderRole === 'staff' ? (input.visibility || 'internal') : 'customer';
  const note = (input.note || '').trim();
  if (note.length > 500) return { ok: false, status: 400, error: 'The evidence note must be 500 characters or fewer.' };

  const { count, error: countError } = await db
    .from('rnx_trust_case_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('trust_case_id', input.caseId);
  if (countError) throw countError;
  if ((count || 0) >= TRUST_CASE_EVIDENCE_MAX_FILES) {
    return { ok: false, status: 409, error: 'This case has reached its limit of 20 evidence files.' };
  }

  await ensureTrustCaseEvidenceBucket(db);
  const fileName = safeTrustCaseEvidenceFileName(input.file.name || 'case-evidence', detected.extension);
  const uploaderId = input.uploaderRole === 'staff'
    ? (input.uploaderStaffId || 'bootstrap-owner')
    : input.uploaderRole === 'supplier'
      ? String(input.uploaderSupplierId || 'unknown-supplier')
      : 'tracking-link';
  const storagePath = `${input.caseId}/${input.uploaderRole}/${uploaderId}/${randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await db.storage.from(TRUST_CASE_EVIDENCE_BUCKET).upload(storagePath, bytes, {
    contentType: detected.mime,
    cacheControl: '300',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  try {
    const { data, error } = await db.rpc('rnx_record_trust_case_attachment', {
      p_case_id: input.caseId,
      p_uploader_role: input.uploaderRole,
      p_uploader_staff_id: input.uploaderStaffId || null,
      p_uploader_supplier_id: input.uploaderSupplierId || null,
      p_actor_email: input.actorEmail || null,
      p_visibility: visibility,
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_mime_type: detected.mime,
      p_file_size_bytes: bytes.byteLength,
      p_note: note || null,
    });
    if (error) {
      if (String(error.message || '').includes('TRUST_CASE_ATTACHMENT_LIMIT')) {
        await db.storage.from(TRUST_CASE_EVIDENCE_BUCKET).remove([storagePath]);
        return { ok: false, status: 409, error: 'This case has reached its limit of 20 evidence files.' };
      }
      throw error;
    }
    const attachmentId = typeof data === 'string' ? data : (data as { id?: string } | null)?.id;
    if (!attachmentId) throw new Error('Trust-case evidence record was not returned.');
    const { data: attachment, error: lookupError } = await db.from('rnx_trust_case_attachments')
      .select('id,trust_case_id,uploader_role,visibility,file_name,mime_type,file_size_bytes,note,created_at')
      .eq('id', attachmentId)
      .single();
    if (lookupError || !attachment) throw lookupError || new Error('Evidence record could not be read after upload.');
    return { ok: true, attachment: attachment as TrustCaseEvidenceAttachment };
  } catch (error) {
    // Keep the object only if the metadata row was committed despite a transport error.
    const { data: committed, error: lookupError } = await db.from('rnx_trust_case_attachments')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle();
    if (!lookupError && !committed) await db.storage.from(TRUST_CASE_EVIDENCE_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function createTrustCaseEvidenceDownload(
  db: SupabaseClient,
  attachment: { storage_path: string; file_name: string },
): Promise<string> {
  const { data, error } = await db.storage.from(TRUST_CASE_EVIDENCE_BUCKET)
    .createSignedUrl(attachment.storage_path, TRUST_CASE_EVIDENCE_SIGNED_URL_SECONDS, { download: attachment.file_name });
  if (error || !data?.signedUrl) throw error || new Error('Evidence download link could not be created.');
  return data.signedUrl;
}
