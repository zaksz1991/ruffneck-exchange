import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getApprovedListingBySlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
function priceLabel(listing: NonNullable<Awaited<ReturnType<typeof getApprovedListingBySlug>>>) {
  if (listing.price_type === 'enquiry' || listing.price === null) return 'Price available on request';
  const value = new Intl.NumberFormat('en-NG', { style: 'currency', currency: listing.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(listing.price));
  return listing.price_type === 'from' ? `From ${value}` : value;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getApprovedListingBySlug(slug);
  if (!listing) return { title: 'Offer not found', robots: { index: false, follow: true } };
  return { title: listing.title, description: `${listing.title} from ${listing.supplier.business_name}. ${listing.category} in ${listing.state}.`, alternates: { canonical: `/marketplace/listing/${slug}` } };
}
export default async function ListingDetailPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getApprovedListingBySlug(slug);
  if (!listing) notFound();
  return <main className="page-shell container narrow-shell">
    <div className="breadcrumbs"><Link href="/marketplace">Marketplace</Link><span>/</span><span>{listing.category}</span></div>
    <article className="listing-detail-card">
      <span className="listing-type">{listing.listing_type}</span>
      <h1>{listing.title}</h1>
      <div className="listing-meta"><span>{listing.category}</span><span>{[listing.city, listing.state].filter(Boolean).join(', ')}</span></div>
      <p className="listing-detail-price">{priceLabel(listing)}</p>
      <div className="listing-description"><h2>Offer details</h2><p>{listing.description}</p></div>
      {listing.condition && <p><strong>Condition:</strong> {listing.condition}</p>}
      <div className="supplier-summary"><span className="listing-type">SUPPLIER</span><h2><Link href={`/suppliers/${listing.supplier.public_slug}`}>{listing.supplier.business_name}</Link></h2><p>{listing.supplier.business_type} · {listing.supplier.state}</p><Link className="text-link" href={`/suppliers/${listing.supplier.public_slug}`}>View supplier profile ↗</Link></div>
      <div className="listing-disclaimer">Confirm current stock, exact specifications, taxes, delivery, warranty and final price before making payment. RNX does not hold supplier stock or guarantee a transaction.</div>
      <Link className="button" href={`/request?category=${encodeURIComponent(listing.category)}`}>Ask RNX about this offer</Link>
    </article>
  </main>;
}
