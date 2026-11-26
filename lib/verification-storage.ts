import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPLIER_VERIFICATION_BUCKET = 'rnx-supplier-verification';
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MIME_TYPES = ['application/pdf','image/jpeg','image/png','image/webp'];

/**
 * Ensure the evidence bucket exists and remains private. Uses the Storage API
 * instead of writing to Supabase's managed storage schema directly.
 */
export async function ensureSupplierVerificationBucket(db: SupabaseClient): Promise<void> {
  const storage = db.storage;
  const { data: current, error: readError } = await storage.getBucket(SUPPLIER_VERIFICATION_BUCKET);
  if (current) {
    if (current.public) {
      const { error } = await storage.updateBucket(SUPPLIER_VERIFICATION_BUCKET, {
        public: false, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: MIME_TYPES,
      });
      if (error) throw error;
    }
    return;
  }
  const { error: createError } = await storage.createBucket(SUPPLIER_VERIFICATION_BUCKET, {
    public: false, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: MIME_TYPES,
  });
  if (createError) {
    // A simultaneous first request may have created the same bucket.
    const { data: afterRace, error: retryError } = await storage.getBucket(SUPPLIER_VERIFICATION_BUCKET);
    if (retryError || !afterRace || afterRace.public) {
      throw createError || readError || retryError || new Error('Private evidence bucket could not be created.');
    }
  }
}
