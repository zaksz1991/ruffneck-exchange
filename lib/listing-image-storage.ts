import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const LISTING_IMAGE_BUCKET = 'rnx-listing-images';
export const LISTING_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const LISTING_IMAGE_SIGNED_URL_SECONDS = 60 * 60;
export const LISTING_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Listing photos are kept in a private bucket. Public marketplace pages receive
 * short-lived signed URLs only for photos attached to approved offers.
 */
export async function ensureListingImageBucket(db: SupabaseClient): Promise<void> {
  const storage = db.storage;
  const options = {
    public: false,
    fileSizeLimit: LISTING_IMAGE_MAX_BYTES,
    allowedMimeTypes: LISTING_IMAGE_MIME_TYPES,
  };
  const { data: current, error: readError } = await storage.getBucket(LISTING_IMAGE_BUCKET);
  if (current) {
    const { error } = await storage.updateBucket(LISTING_IMAGE_BUCKET, options);
    if (error) throw error;
    return;
  }
  const { error: createError } = await storage.createBucket(LISTING_IMAGE_BUCKET, options);
  if (createError) {
    const { data: afterRace, error: retryError } = await storage.getBucket(LISTING_IMAGE_BUCKET);
    if (retryError || !afterRace || afterRace.public) {
      throw createError || readError || retryError || new Error('Private listing image bucket could not be created.');
    }
  }
}

export async function signedListingImageUrl(db: SupabaseClient, imagePath: string | null | undefined): Promise<string | null> {
  if (!imagePath) return null;
  try {
    const { data, error } = await db.storage.from(LISTING_IMAGE_BUCKET)
      .createSignedUrl(imagePath, LISTING_IMAGE_SIGNED_URL_SECONDS);
    if (error) {
      console.error('[RNX listing image URL]', error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (error) {
    console.error('[RNX listing image URL]', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
