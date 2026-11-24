import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-server';
import { signedListingImageUrl } from '@/lib/listing-image-storage';

export type PublicSupplier = {
  id: string;
  public_slug: string;
  business_name: string;
  business_type: string;
  category: string;
  state: string;
  website: string | null;
  description: string;
  is_verified: boolean;
  verification_expires_at: string | null;
};

export type ListingGalleryImage = { id: string; image_url: string; sort_order: number };
export type ListingAvailability = 'unconfirmed' | 'available' | 'limited' | 'on_request' | 'out_of_stock';

export type PublicListing = {
  id: string;
  slug: string;
  title: string;
  listing_type: 'product' | 'service' | 'wholesale' | 'rental';
  category: string;
  description: string;
  state: string;
  city: string | null;
  price_type: 'enquiry' | 'fixed' | 'from';
  price: number | null;
  currency: string;
  condition: string | null;
  keywords: string[] | null;
  created_at: string;
  availability_status: ListingAvailability;
  availability_note: string | null;
  availability_updated_at: string | null;
  image_url: string | null;
  gallery_images?: ListingGalleryImage[];
  supplier: PublicSupplier;
};

export type ListingSort = 'newest' | 'oldest' | 'title';
export type ListingFilters = {
  q?: string;
  state?: string;
  category?: string;
  listingType?: PublicListing['listing_type'];
  priceType?: PublicListing['price_type'];
  availability?: Exclude<ListingAvailability, 'unconfirmed'>;
  sort?: ListingSort;
  limit?: number;
  includeImages?: boolean;
};

function cleanSearch(value: string): string {
  return value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

function containsTerms(value: string, query: string): boolean {
  const terms = cleanSearch(query).split(' ').filter(Boolean);
  const haystack = cleanSearch(value);
  return terms.length === 0 || terms.every((term) => haystack.includes(term));
}

export async function getApprovedListings(filters: ListingFilters = {}): Promise<PublicListing[]> {
  try {
    const db = supabaseAdmin();
    let query = db
      .from('rnx_listings')
      .select('id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,availability_status,availability_note,availability_updated_at,image_path,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null);

    // Apply structured filters in Postgres before the bounded result set is fetched.
    if (filters.state) query = query.eq('state', filters.state);
    if (filters.listingType) query = query.eq('listing_type', filters.listingType);
    if (filters.priceType) query = query.eq('price_type', filters.priceType);
    if (filters.availability) query = query.eq('availability_status', filters.availability);

    if (filters.sort === 'title') {
      query = query.order('title', { ascending: true }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: filters.sort === 'oldest' });
    }

    const { data, error } = await query.limit(Math.min(Math.max(filters.limit ?? 100, 1), 100));
    if (error) {
      console.error('[RNX] Approved listings query failed:', { code: error.code, message: error.message });
      return [];
    }

    const rows = (data ?? []) as unknown as PublicListing[];
    const q = cleanSearch(filters.q ?? '');
    const category = cleanSearch(filters.category ?? '');

    const filtered = rows.filter((listing) => {
      if (category && !cleanSearch(listing.category).includes(category) && !category.includes(cleanSearch(listing.category))) return false;
      if (q) {
        const searchable = [listing.title, listing.category, listing.description, listing.state, listing.city ?? '', ...(listing.keywords ?? []), listing.supplier.business_name].join(' ');
        if (!containsTerms(searchable, q)) return false;
      }
      return true;
    });
    return await Promise.all(filtered.map(async (listing: any) => ({
      ...listing,
      image_url: filters.includeImages === false ? null : await signedListingImageUrl(db, listing.image_path),
    }))) as PublicListing[];
  } catch (error) {
    console.error('[RNX] Catalogue unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

export async function getApprovedListingBySlug(slug: string, options: { includeImage?: boolean } = {}): Promise<PublicListing | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_listings')
      .select('id,supplier_application_id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,availability_status,availability_note,availability_updated_at,image_path,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('slug', slug)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null)
      .maybeSingle();
    if (error) {
      console.error('[RNX] Listing detail query failed:', { code: error.code, message: error.message });
      return null;
    }
    if (!data) return null;
    const row = data as any;
    if (options.includeImage === false) return { ...row, image_url: null, gallery_images: [] } as PublicListing;

    const [coverUrl, galleryResult] = await Promise.all([
      signedListingImageUrl(db, row.image_path),
      db.from('rnx_listing_gallery_images')
        .select('id,image_path,sort_order')
        .eq('listing_id', row.id)
        .eq('supplier_application_id', row.supplier_application_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);
    if (galleryResult.error) {
      console.error('[RNX] Listing gallery query failed:', { code: galleryResult.error.code, message: galleryResult.error.message });
    }
    const galleryImages = await Promise.all((galleryResult.data ?? []).map(async (photo: any) => ({
      id: photo.id,
      sort_order: photo.sort_order,
      image_url: await signedListingImageUrl(db, photo.image_path),
    })));
    return { ...row, image_url: coverUrl, gallery_images: galleryImages.filter((photo) => photo.image_url) } as PublicListing;
  } catch (error) {
    console.error('[RNX] Listing detail unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function getApprovedSuppliers(q = ''): Promise<PublicSupplier[]> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_supplier_applications')
      .select('id,public_slug,business_name,business_type,category,state,website,description,verification_status,verification_expires_at')
      .eq('status', 'approved')
      .not('public_slug', 'is', null)
      .order('business_name', { ascending: true })
      .limit(100);
    if (error) {
      console.error('[RNX] Approved suppliers query failed:', { code: error.code, message: error.message });
      return [];
    }
    const now = Date.now();
    const rows = (data ?? []).map((row: any) => ({ ...row, is_verified: row.verification_status === 'verified' && Boolean(row.verification_expires_at && new Date(row.verification_expires_at).getTime() > now), verification_expires_at: row.verification_expires_at || null })) as PublicSupplier[];
    const query = cleanSearch(q);
    return query ? rows.filter((supplier) => containsTerms([supplier.business_name, supplier.business_type, supplier.category, supplier.state, supplier.description].join(' '), query)) : rows;
  } catch (error) {
    console.error('[RNX] Supplier directory unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

export async function getApprovedSupplierBySlug(slug: string): Promise<PublicSupplier | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_supplier_applications')
      .select('id,public_slug,business_name,business_type,category,state,website,description,verification_status,verification_expires_at')
      .eq('public_slug', slug)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) {
      console.error('[RNX] Supplier profile query failed:', { code: error.code, message: error.message });
      return null;
    }
    if (!data) return null;
    const row = data as any;
    return { ...row, is_verified: row.verification_status === 'verified' && Boolean(row.verification_expires_at && new Date(row.verification_expires_at).getTime() > Date.now()), verification_expires_at: row.verification_expires_at || null } as PublicSupplier;
  } catch (error) {
    console.error('[RNX] Supplier profile unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function getApprovedListingsForSupplier(supplierId: string): Promise<PublicListing[]> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_listings')
      .select('id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,availability_status,availability_note,availability_updated_at,image_path,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('supplier_application_id', supplierId)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[RNX] Supplier listings query failed:', { code: error.code, message: error.message });
      return [];
    }
    return await Promise.all((data ?? []).map(async (row: any) => ({
      ...row,
      image_url: await signedListingImageUrl(db, row.image_path),
    }))) as PublicListing[];
  } catch (error) {
    console.error('[RNX] Supplier listings unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}
