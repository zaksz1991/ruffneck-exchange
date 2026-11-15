import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-server';

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
  supplier: PublicSupplier;
};

function cleanSearch(value: string): string {
  return value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

function containsTerms(value: string, query: string): boolean {
  const terms = cleanSearch(query).split(' ').filter(Boolean);
  const haystack = cleanSearch(value);
  return terms.length === 0 || terms.every((term) => haystack.includes(term));
}

export async function getApprovedListings(filters: { q?: string; state?: string; category?: string; limit?: number } = {}): Promise<PublicListing[]> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_listings')
      .select('id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(filters.limit ?? 100, 1), 100));
    if (error) {
      console.error('[RNX] Approved listings query failed:', { code: error.code, message: error.message });
      return [];
    }
    const rows = (data ?? []) as unknown as PublicListing[];
    const q = cleanSearch(filters.q ?? '');
    const state = cleanSearch(filters.state ?? '');
    const category = cleanSearch(filters.category ?? '');
    return rows.filter((listing) => {
      if (state && cleanSearch(listing.state) !== state) return false;
      if (category && !cleanSearch(listing.category).includes(category) && !category.includes(cleanSearch(listing.category))) return false;
      if (q) {
        const searchable = [listing.title, listing.category, listing.description, listing.state, listing.city ?? '', ...(listing.keywords ?? []), listing.supplier.business_name].join(' ');
        if (!containsTerms(searchable, q)) return false;
      }
      return true;
    });
  } catch (error) {
    console.error('[RNX] Catalogue unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

export async function getApprovedListingBySlug(slug: string): Promise<PublicListing | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('rnx_listings')
      .select('id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('slug', slug)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .not('supplier.public_slug', 'is', null)
      .maybeSingle();
    if (error) {
      console.error('[RNX] Listing detail query failed:', { code: error.code, message: error.message });
      return null;
    }
    return data as unknown as PublicListing | null;
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
      .select('id,slug,title,listing_type,category,description,state,city,price_type,price,currency,condition,keywords,created_at,supplier:rnx_supplier_applications!inner(id,public_slug,business_name,business_type,category,state,website,description,status)')
      .eq('supplier_application_id', supplierId)
      .eq('status', 'approved')
      .eq('supplier.status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[RNX] Supplier listings query failed:', { code: error.code, message: error.message });
      return [];
    }
    return (data ?? []) as unknown as PublicListing[];
  } catch (error) {
    console.error('[RNX] Supplier listings unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}
