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

async function loadEditableListing(id: string, supplierId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('rnx_listings')
    .select('id,status,image_path')
    .eq('id', id)
    .eq('supplier_application_id', supplierId)
    .maybeSingle();
  if (error) throw new Error('Listing lookup failed.');
  if (!data) return { db, listing: null };
  if (!EDITABLE_STATUSES.includes(data.status)) {
    return { db, listing: null, conflict: 'Pause this approved listing before changing its image. Only pending, rejected or paused offers can receive supplier image updates.' };
  }
  return { db, listing: data };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Choose a valid image file.' }, { status: 400 });
  }
  const file = form.get('image');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Choose a JPEG, PNG or WebP cover image.' }, { status: 400 });
  }
  if (file.size < 1 || file.size > LISTING_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'The image must be smaller than 4 MB.' }, { status: 400 });
  }

  try {
    const { db, listing, conflict } = await loadEditableListing(id, supplier.id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return NextResponse.json({ error: 'Unsupported image. Use a real JPEG, PNG or WebP file; SVG and renamed files are not accepted.' }, { status: 415 });

    await ensureListingImageBucket(db);
    const storagePath = `${supplier.id}/${id}/${randomUUID()}.${detected.extension}`;
    const { error: uploadError } = await db.storage.from(LISTING_IMAGE_BUCKET).upload(storagePath, bytes, {
      contentType: detected.mime,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      console.error('[RNX listing image upload]', { message: uploadError.message });
      return NextResponse.json({ error: 'Image upload failed. Check that the RNX listing-image storage bucket is available.' }, { status: 503 });
    }

    const { data: updated, error: updateError } = await db.from('rnx_listings').update({
      image_path: storagePath,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('supplier_application_id', supplier.id).eq('status', listing.status)
      .select('id,title,status,image_path').maybeSingle();

    if (updateError || !updated) {
      await db.storage.from(LISTING_IMAGE_BUCKET).remove([storagePath]);
      if (updateError) console.error('[RNX listing image database update]', updateError.message);
      return NextResponse.json({ error: 'The listing changed while the image was uploading. Refresh the supplier portal and retry.' }, { status: 409 });
    }

    if (listing.image_path && listing.image_path !== storagePath) {
      const { error: removeError } = await db.storage.from(LISTING_IMAGE_BUCKET).remove([listing.image_path]);
      if (removeError) console.error('[RNX replaced listing image cleanup]', removeError.message);
    }

    try {
      const { error: auditError } = await db.from('rnx_admin_audit_log').insert({
        action: 'supplier_listing_image_uploaded',
        entity_type: 'listing',
        entity_id: id,
        details: { supplier_application_id: supplier.id, mime_type: detected.mime, file_size_bytes: file.size },
      });
      if (auditError) console.error('[RNX listing image audit]', auditError.message);
    } catch (auditError) {
      // Audit logging is best-effort: a completed image upload must not be reported as failed.
      console.error('[RNX listing image audit]', auditError instanceof Error ? auditError.message : 'Audit insert failed');
    }

    return NextResponse.json({
      ok: true,
      image_url: await signedListingImageUrl(db, storagePath),
      message: 'Cover image uploaded. The offer remains hidden until RNX approves the listing.',
    }, { status: 201 });
  } catch (error) {
    console.error('[RNX listing image upload]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The cover image could not be saved. Try again later.' }, { status: 503 });
  }
}
