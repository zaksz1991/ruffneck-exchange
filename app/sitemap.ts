import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { getApprovedListings, getApprovedSuppliers } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/marketplace', '/suppliers', '/plans', '/request', '/business/register', '/how-it-works', '/about', '/ruffneck', '/privacy', '/terms'];
  const staticEntries = pages.map((path, index) => ({ url: `${site.url}${path}`, lastModified: new Date(), changeFrequency: index < 3 ? 'weekly' as const : 'monthly' as const, priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.5 }));
  const [listings, suppliers] = await Promise.all([getApprovedListings({ limit: 100 }), getApprovedSuppliers()]);
  const listingEntries = listings.map(item => ({ url: `${site.url}/marketplace/listing/${item.slug}`, lastModified: new Date(item.created_at), changeFrequency: 'weekly' as const, priority: 0.7 }));
  const supplierEntries = suppliers.map(item => ({ url: `${site.url}/suppliers/${item.public_slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 }));
  return [...staticEntries, ...listingEntries, ...supplierEntries];
}
