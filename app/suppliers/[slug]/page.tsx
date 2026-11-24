import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getApprovedListingsForSupplier, getApprovedSupplierBySlug, getApprovedSupplierReviews } from '@/lib/catalog';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
function stamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-NG', { dateStyle: 'medium' }); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getApprovedSupplierBySlug(slug);
  if (!supplier) return { title: 'Supplier not found', robots: { index: false, follow: true } };
  return { title: supplier.business_name, description: `${supplier.business_name} — approved supplier profile on RuffNeck Exchange. ${supplier.category}, ${supplier.state}.`, alternates: { canonical: `/suppliers/${slug}` } };
}
export default async function SupplierProfilePage({ params }: Props) {
  const { slug } = await params;
  const supplier = await getApprovedSupplierBySlug(slug);
  if (!supplier) notFound();
  const [listings, feedback] = await Promise.all([
    getApprovedListingsForSupplier(supplier.id),
    getApprovedSupplierReviews(supplier.id),
  ]);
  return <main className="page-shell container">
    <div className="breadcrumbs"><Link href="/suppliers">Approved suppliers</Link><span>/</span><span>{supplier.business_name}</span></div>
    <section className="supplier-profile-hero"><span className="listing-type">APPROVED BUSINESS</span>{supplier.is_verified && <span className="verification-badge">RNX DOCUMENT REVIEWED · VALID UNTIL {new Date(supplier.verification_expires_at || '').toLocaleDateString('en-NG')}</span>}<h1>{supplier.business_name}</h1><p className="supplier-kind">{supplier.business_type} · {supplier.category} · {supplier.state}</p><p>{supplier.description}</p>{supplier.website && <a className="text-link" href={supplier.website} target="_blank" rel="noopener noreferrer">Visit business website ↗</a>}
      <div className="supplier-review-summary"><strong>{feedback.total ? `${feedback.average.toFixed(1)} / 5` : 'No reviews yet'}</strong><span>{feedback.total ? `Based on the latest ${feedback.total} displayed verified customer ${feedback.total === 1 ? 'review' : 'reviews'}` : 'Verified reviews will appear after confirmed transactions and RNX moderation.'}</span></div>
    </section>
    <div className="section-heading compact-heading"><div><p className="eyebrow">PUBLISHED OFFERS</p><h2>Products and services from this business</h2></div></div>
    {listings.length ? <div className="listing-grid">{listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="empty-state"><p>This business has no approved offers published at present.</p><Link href="/request" className="button">Submit a sourcing request</Link></div>}
    <section className="supplier-public-reviews"><div className="section-heading compact-heading"><div><p className="eyebrow">VERIFIED CUSTOMER FEEDBACK</p><h2>Customer reviews</h2><p>Reviews are eligible only after both parties confirm a completed introduction and RNX approves publication.</p></div></div>
      {feedback.reviews.length ? <div className="supplier-public-review-list">{feedback.reviews.map((review) => <article className="supplier-public-review-card" key={review.id}><div className="supplier-public-review-top"><span aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><time dateTime={review.created_at}>{stamp(review.created_at)}</time></div><h3>{review.title}</h3><p>{review.body}</p>{review.supplier_response && <div className="supplier-public-review-response"><strong>Supplier response</strong><p>{review.supplier_response}</p>{review.supplier_response_at && <time dateTime={review.supplier_response_at}>{stamp(review.supplier_response_at)}</time>}</div>}</article>)}</div> : <div className="empty-state"><p>No verified customer reviews have been published for this supplier yet.</p></div>}
    </section>
    <p className="fine-print">RNX approval means the business application passed its review process. The separate document-reviewed badge, where displayed, means specified business evidence was reviewed by RNX until the stated expiry date. Verified reviews indicate that the customer and supplier independently confirmed a completed introduction; RNX does not independently guarantee the transaction, goods, services, stock, quality, solvency, licensing or legal compliance. Independently confirm exact specifications, price, availability and fulfilment terms.</p>
  </main>;
}
