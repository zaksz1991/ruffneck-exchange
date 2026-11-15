import Link from 'next/link';
import type { PublicListing } from '@/lib/catalog';

function formatPrice(listing: PublicListing): string {
  if (listing.price_type === 'enquiry' || listing.price === null) return 'Request a quotation';
  const value = new Intl.NumberFormat('en-NG', { style: 'currency', currency: listing.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(listing.price));
  return listing.price_type === 'from' ? `From ${value}` : value;
}

export function ListingCard({ listing }: { listing: PublicListing }) {
  return (
    <article className="listing-card">
      <Link className="listing-main-link" href={`/marketplace/listing/${listing.slug}`}>
        <span className="listing-type">{listing.listing_type}</span>
        <h3>{listing.title}</h3>
        <p>{listing.description.length > 145 ? `${listing.description.slice(0, 145).trim()}…` : listing.description}</p>
        <span className="listing-price">{formatPrice(listing)}</span>
      </Link>
      <div className="listing-meta"><span>{listing.category}</span><span>{[listing.city, listing.state].filter(Boolean).join(', ')}</span></div>
      <div className="listing-supplier"><span>Listed by</span><Link href={`/suppliers/${listing.supplier.public_slug}`}>{listing.supplier.business_name}</Link></div>
    </article>
  );
}
