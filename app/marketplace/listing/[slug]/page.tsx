import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getApprovedListingBySlug } from '@/lib/catalog';
import { ListingGallery } from '@/components/listing-gallery';
import { SaveListingButton } from '@/components/save-listing-button';
import { currentCustomerId } from '@/lib/customer-auth';
import { ListingViewTracker } from '@/components/listing-view-tracker';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
function priceLabel(listing: NonNullable<Awaited<ReturnType<typeof getApprovedListingBySlug>>>) {
  if (listing.price_type === 'enquiry' || listing.price === null) return 'Price available on request';
  const value = new Intl.NumberFormat('en-NG', { style: 'currency', currency: listing.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(listing.price));
  return listing.price_type === 'from' ? `From ${value}` : value;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getApprovedListingBySlug(slug, { includeImage: false });
  if (!listing) return { title: 'Offer not found', robots: { index: false, follow: true } };
  return { title: listing.title, description: `${listing.title} from ${listing.supplier.business_name}. ${listing.category} in ${listing.state}.`, alternates: { canonical: `/marketplace/listing/${slug}` } };
}
export default async function ListingDetailPage({ params }: Props) {
  const { slug } = await params;
  const [listing, customerId] = await Promise.all([getApprovedListingBySlug(slug), currentCustomerId()]);
  if (!listing) notFound();
  return <main className="page-shell container narrow-shell">
    <ListingViewTracker listingId={listing.id} />
    <div className="breadcrumbs"><Link href="/marketplace">Marketplace</Link><span>/</span><span>{listing.category}</span></div>
    <article className="listing-detail-card">
      <ListingGallery title={listing.title} category={listing.category} coverUrl={listing.image_url} galleryImages={listing.gallery_images || []} />
      <span className="listing-type">{listing.listing_type}</span>
      <h1>{listing.title}</h1>
      <div className="listing-meta"><span>{listing.category}</span><span>{[listing.city, listing.state].filter(Boolean).join(', ')}</span></div>
      <p className="listing-detail-price">{priceLabel(listing)}</p>
      <section className={`listing-availability-panel availability-${listing.availability_status || 'unconfirmed'}`} aria-label="Supplier-reported availability">
        <strong>{listing.availability_status === 'available' ? 'Supplier reports this offer is available' : listing.availability_status === 'limited' ? 'Supplier reports limited availability' : listing.availability_status === 'on_request' ? 'Availability must be confirmed on request' : listing.availability_status === 'out_of_stock' ? 'Supplier reports this offer is currently unavailable' : 'Availability has not been confirmed by the supplier'}</strong>
        {listing.availability_note && <p>{listing.availability_note}</p>}
        {listing.availability_updated_at && <small>Supplier update: {new Date(listing.availability_updated_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
        <small>Availability is reported by the supplier and is not independently verified by RNX. Confirm before ordering or paying.</small>
      </section>
      <div className="listing-description"><h2>Offer details</h2><p>{listing.description}</p></div>
      {listing.condition && <p><strong>Condition:</strong> {listing.condition}</p>}
      <div className="supplier-summary"><span className="listing-type">SUPPLIER</span><h2><Link href={`/suppliers/${listing.supplier.public_slug}`}>{listing.supplier.business_name}</Link></h2><p>{listing.supplier.business_type} · {listing.supplier.state}</p><Link className="text-link" href={`/suppliers/${listing.supplier.public_slug}`}>View supplier profile ↗</Link></div>
      <div className="listing-disclaimer">Confirm current stock, exact specifications, taxes, delivery, warranty and final price before making payment. RNX does not hold supplier stock or guarantee a transaction.</div>
      <div className="listing-detail-actions">
        <Link className="button" href={`/request?listing=${encodeURIComponent(listing.slug)}`}>Enquire about this offer — free</Link>
        <SaveListingButton listingId={listing.id} isSignedIn={Boolean(customerId)} />
      </div>
    </article>
  </main>;
}
