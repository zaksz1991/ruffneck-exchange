import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  ensureListingImageBucket,
  LISTING_IMAGE_BUCKET,
  LISTING_IMAGE_MAX_BYTES,
  signedListingImageUrl,
} from '@/lib/listing-image-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EDITABLE_STATUSES = ['pending', 'rejected', 'paused'];
const MAX_GALLERY_IMAGES = 4;

type DetectedImage = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; extension: 'jpg' | 'png' | 'webp' };

function detectImage(bytes: Uint8Array): DetectedImage | null {
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

async function findEditableListing(db: ReturnType<typeof supabaseAdmin>, listingId: string, supplierId: string) {
  const { data: listing, error } = await db.from('rnx_listings')
    .select('id,status')
    .eq('id', listingId)
    .eq('supplier_application_id', supplierId)
    .maybeSingle();
  if (error) throw new Error('Listing lookup failed.');
  if (!listing) return { listing: null, conflict: null };
  if (!EDITABLE_STATUSES.includes(listing.status)) {
    return { listing: null, conflict: 'Pause this approved listing before changing its gallery. Only pending, rejected or paused offers can receive supplier photo updates.' };
  }
  return { listing, conflict: null };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'Choose one or more valid image files.' }, { status: 400 }); }

  const entries = form.getAll('images');
  if (entries.length < 1 || entries.length > MAX_GALLERY_IMAGES || entries.some((entry) => typeof entry === 'string' || !entry || entry.size < 1)) {
    return NextResponse.json({ error: 'Choose between one and four additional JPEG, PNG or WebP photos.' }, { status: 400 });
  }
  const files = entries as File[];
  if (files.some((file) => file.size > LISTING_IMAGE_MAX_BYTES)) {
    return NextResponse.json({ error: 'Each additional photo must be 4 MB or smaller.' }, { status: 413 });
  }

  try {
    const db = supabaseAdmin();
    const { listing, conflict } = await findEditableListing(db, id, supplier.id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    const { data: existing, error: existingError } = await db.from('rnx_listing_gallery_images')
      .select('id,image_path,sort_order,created_at')
      .eq('listing_id', id)
      .eq('supplier_application_id', supplier.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (existingError) throw new Error('Listing gallery could not be loaded. Apply migration 016 first.');
    const currentCount = existing?.length ?? 0;
    if (currentCount + files.length > MAX_GALLERY_IMAGES) {
      return NextResponse.json({ error: `This listing can have up to four additional gallery photos. It currently has ${currentCount}; remove a photo before adding more.` }, { status: 409 });
    }

    const validated: Array<{ file: File; bytes: Uint8Array; detected: DetectedImage }> = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectImage(bytes);
      if (!detected) {
        return NextResponse.json({ error: 'Unsupported image. Use genuine JPEG, PNG or WebP files. SVG files and renamed file extensions are not accepted.' }, { status: 415 });
      }
      validated.push({ file, bytes, detected });
    }

    await ensureListingImageBucket(db);
    const uploadedPaths: string[] = [];
    const rows: Array<{ listing_id: string; supplier_application_id: string; image_path: string; sort_order: number }> = [];

    for (const [index, item] of validated.entries()) {
      const storagePath = `${supplier.id}/${id}/gallery/${randomUUID()}.${item.detected.extension}`;
      const { error: uploadError } = await db.storage.from(LISTING_IMAGE_BUCKET).upload(storagePath, item.bytes, {
        contentType: item.detected.mime,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) {
        if (uploadedPaths.length) {
          const { error: cleanupError } = await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploadedPaths);
          if (cleanupError) console.error('[RNX listing gallery rollback cleanup]', cleanupError.message);
        }
        console.error('[RNX listing gallery upload]', uploadError.message);
        return NextResponse.json({ error: 'One or more gallery photos could not be uploaded. No gallery changes were saved.' }, { status: 503 });
      }
      uploadedPaths.push(storagePath);
      rows.push({ listing_id: id, supplier_application_id: supplier.id, image_path: storagePath, sort_order: currentCount + index + 1 });
    }

    const { data: inserted, error: insertError } = await db.from('rnx_listing_gallery_images')
      .insert(rows)
      .select('id,image_path,sort_order,created_at');
    if (insertError || !inserted) {
      const { error: cleanupError } = await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploadedPaths);
      if (cleanupError) console.error('[RNX listing gallery rollback cleanup]', cleanupError.message);
      console.error('[RNX listing gallery database insert]', insertError?.message || 'No inserted rows returned');
      if (insertError?.code === '23514') {
        return NextResponse.json({ error: 'The listing changed or reached its four-photo limit. Refresh the supplier portal and try again.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'The gallery records could not be saved. No gallery changes were retained.' }, { status: 503 });
    }

    try {
      const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
        action: 'supplier_listing_gallery_uploaded',
        entity_type: 'listing',
        entity_id: id,
        details: { supplier_application_id: supplier.id, image_count: inserted.length, file_sizes_bytes: validated.map((item) => item.file.size) },
      });
      if (auditError) console.error('[RNX listing gallery audit]', auditError.message);
    } catch (auditError) {
      console.error('[RNX listing gallery audit]', auditError instanceof Error ? auditError.message : 'Audit insert failed');
    }

    const galleryImages = await Promise.all(inserted.map(async (row) => ({
      id: row.id,
      sort_order: row.sort_order,
      image_url: await signedListingImageUrl(db, row.image_path),
    })));
    return NextResponse.json({ ok: true, gallery_images: galleryImages, message: `${inserted.length} additional photo${inserted.length === 1 ? '' : 's'} added to the listing.` }, { status: 201 });
  } catch (error) {
    console.error('[RNX listing gallery upload]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The listing gallery is temporarily unavailable.' }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  const raw: unknown = await request.json().catch(() => null);
  const imageId = raw && typeof raw === 'object' ? (raw as { imageId?: unknown }).imageId : null;
  if (typeof imageId !== 'string' || !UUID.test(imageId)) return NextResponse.json({ error: 'Choose a valid gallery photo.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { listing, conflict } = await findEditableListing(db, id, supplier.id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    const { data: photo, error: photoError } = await db.from('rnx_listing_gallery_images')
      .select('id,image_path,sort_order')
      .eq('id', imageId)
      .eq('listing_id', id)
      .eq('supplier_application_id', supplier.id)
      .maybeSingle();
    if (photoError) throw new Error('Gallery photo lookup failed.');
    if (!photo) return NextResponse.json({ error: 'Gallery photo not found.' }, { status: 404 });

    const { data: deleted, error: deleteError } = await db.from('rnx_listing_gallery_images')
      .delete()
      .eq('id', imageId)
      .eq('listing_id', id)
      .eq('supplier_application_id', supplier.id)
      .select('id')
      .maybeSingle();
    if (deleteError?.code === '23514') {
      return NextResponse.json({ error: 'The listing is no longer editable. Refresh the supplier portal before changing gallery photos.' }, { status: 409 });
    }
    if (deleteError || !deleted) throw new Error('Gallery photo could not be removed. Refresh the supplier portal and try again.');

    const { error: storageError } = await db.storage.from(LISTING_IMAGE_BUCKET).remove([photo.image_path]);
    if (storageError) console.error('[RNX listing gallery cleanup]', storageError.message);

    try {
      const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
        action: 'supplier_listing_gallery_photo_removed',
        entity_type: 'listing',
        entity_id: id,
        details: { supplier_application_id: supplier.id, gallery_image_id: imageId },
      });
      if (auditError) console.error('[RNX listing gallery audit]', auditError.message);
    } catch (auditError) {
      console.error('[RNX listing gallery audit]', auditError instanceof Error ? auditError.message : 'Audit insert failed');
    }

    return NextResponse.json({ ok: true, message: storageError ? 'Photo removed from the listing. Storage cleanup will require operations attention.' : 'Photo removed from the listing gallery.' });
  } catch (error) {
    console.error('[RNX listing gallery delete]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: error instanceof Error && error.message.includes('Refresh the supplier portal') ? error.message : 'The gallery photo could not be removed.' }, { status: 503 });
  }
}
