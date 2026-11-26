import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COMMERCIAL_QUOTE_ATTACHMENT_BUCKET = 'rnx-commercial-quote-attachments';
export const COMMERCIAL_QUOTE_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const COMMERCIAL_QUOTE_ATTACHMENT_MAX_FILES_PER_QUOTE = 20;
export const COMMERCIAL_QUOTE_ATTACHMENT_SIGNED_URL_SECONDS = 300;
export const COMMERCIAL_QUOTE_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type CommercialQuoteAttachmentMime = typeof COMMERCIAL_QUOTE_ATTACHMENT_MIME_TYPES[number];
export type DetectedCommercialQuoteAttachment = {
  mime: CommercialQuoteAttachmentMime;
  extension: 'pdf' | 'jpg' | 'png' | 'webp';
};

export function detectCommercialQuoteAttachment(bytes: Uint8Array): DetectedCommercialQuoteAttachment | null {
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

export function safeCommercialQuoteFileName(originalName: string, extension: DetectedCommercialQuoteAttachment['extension']): string {
  const baseName = originalName
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100);
  return `${baseName || 'quotation-attachment'}.${extension}`;
}

export async function ensureCommercialQuoteAttachmentBucket(db: SupabaseClient): Promise<void> {
  const options = {
    public: false,
    fileSizeLimit: COMMERCIAL_QUOTE_ATTACHMENT_MAX_BYTES,
    allowedMimeTypes: [...COMMERCIAL_QUOTE_ATTACHMENT_MIME_TYPES],
  };
  const { data: current, error: readError } = await db.storage.getBucket(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET);
  if (current) {
    const currentTypes = [...(current.allowed_mime_types || [])].sort();
    const requiredTypes = [...options.allowedMimeTypes].sort();
    if (current.public || current.file_size_limit !== options.fileSizeLimit
      || JSON.stringify(currentTypes) !== JSON.stringify(requiredTypes)) {
      const { error } = await db.storage.updateBucket(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET, options);
      if (error) throw error;
    }
    return;
  }
  const { error: createError } = await db.storage.createBucket(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET, options);
  if (createError) {
    const { data: afterRace, error: retryError } = await db.storage.getBucket(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET);
    if (retryError || !afterRace) {
      throw createError || readError || retryError || new Error('Private commercial quotation attachment bucket could not be created.');
    }
    const { error: configureError } = await db.storage.updateBucket(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET, options);
    if (configureError) throw configureError;
  }
}

export type QuoteAttachmentSenderRole = 'customer' | 'supplier';

export async function uploadCommercialQuoteAttachment(
  db: SupabaseClient,
  input: {
    quoteId: string;
    senderRole: QuoteAttachmentSenderRole;
    senderId: string;
    file: File;
    note?: string;
  },
): Promise<{ ok: true; message_id: string; attachment_id: string; file_name: string } | { ok: false; status: 400 | 409 | 413 | 415; error: string }> {
  if (input.file.size < 1 || input.file.size > COMMERCIAL_QUOTE_ATTACHMENT_MAX_BYTES) {
    return { ok: false, status: input.file.size > COMMERCIAL_QUOTE_ATTACHMENT_MAX_BYTES ? 413 : 400, error: 'Choose a file between 1 byte and 4 MB.' };
  }
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const detected = detectCommercialQuoteAttachment(bytes);
  const declaredMimeIsSupported = (COMMERCIAL_QUOTE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(input.file.type);
  if (!detected || (declaredMimeIsSupported && input.file.type !== detected.mime)) {
    return { ok: false, status: 415, error: 'The file content must be a genuine PDF, JPEG, PNG or WebP file.' };
  }
  const note = (input.note || '').trim();
  if (note.length === 1) return { ok: false, status: 400, error: 'Use at least 2 characters for the optional note, or leave it blank.' };
  if (note.length > 1000) return { ok: false, status: 400, error: 'The attachment note must be 1,000 characters or fewer.' };
  const { count, error: countError } = await db
    .from('rnx_commercial_quote_message_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', input.quoteId);
  if (countError) throw countError;
  if ((count || 0) >= COMMERCIAL_QUOTE_ATTACHMENT_MAX_FILES_PER_QUOTE) {
    return { ok: false, status: 409, error: 'This quotation has reached its limit of 20 shared files.' };
  }

  const fileName = safeCommercialQuoteFileName(input.file.name || 'quotation-attachment', detected.extension);
  const storagePath = `${input.quoteId}/${input.senderRole}/${input.senderId}/${randomUUID()}.${detected.extension}`;
  await ensureCommercialQuoteAttachmentBucket(db);
  const { error: uploadError } = await db.storage
    .from(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET)
    .upload(storagePath, bytes, { contentType: detected.mime, cacheControl: '300', upsert: false });
  if (uploadError) throw uploadError;

  try {
    const { data, error } = await db.rpc('rnx_send_commercial_quote_attachment', {
      p_quote_id: input.quoteId,
      p_sender_role: input.senderRole,
      p_sender_id: input.senderId,
      p_message_body: note || 'Shared an attachment.',
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_mime_type: detected.mime,
      p_file_size_bytes: bytes.byteLength,
    });
    if (error) {
      if (error.message?.includes('QUOTATION_ATTACHMENT_LIMIT')) {
        await db.storage.from(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET).remove([storagePath]);
        return { ok: false, status: 409, error: 'This quotation has reached its limit of 20 shared files.' };
      }
      throw error;
    }
    const result = data as { ok?: boolean; error?: string; message_id?: string; attachment_id?: string; file_name?: string };
    if (!result?.ok || !result.message_id || !result.attachment_id) {
      await db.storage.from(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET).remove([storagePath]);
      return { ok: false, status: 409, error: result?.error || 'The attachment could not be added to this conversation.' };
    }
    return {
      ok: true,
      message_id: result.message_id,
      attachment_id: result.attachment_id,
      file_name: result.file_name || fileName,
    };
  } catch (error) {
    // An RPC transport error can be ambiguous: the database may have committed
    // before the connection failed. Remove the object only when no metadata row
    // exists, otherwise keep the file attached to its committed message.
    const { data: committedAttachment, error: lookupError } = await db
      .from('rnx_commercial_quote_message_attachments')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle();
    if (!lookupError && !committedAttachment) {
      await db.storage.from(COMMERCIAL_QUOTE_ATTACHMENT_BUCKET).remove([storagePath]);
    }
    throw error;
  }
}
