import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getApprovedListingsForSupplier, getApprovedSupplierBySlug } from '@/lib/catalog';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
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
  const listings = await getApprovedListingsForSupplier(supplier.id);
  return <main className="page-shell container">
    <div className="breadcrumbs"><Link href="/suppliers">Approved suppliers</Link><span>/</span><span>{supplier.business_name}</span></div>
    <section className="supplier-profile-hero"><span className="listing-type">APPROVED BUSINESS</span><h1>{supplier.business_name}</h1><p className="supplier-kind">{supplier.business_type} · {supplier.category} · {supplier.state}</p><p>{supplier.description}</p>{supplier.website && <a className="text-link" href={supplier.website} target="_blank" rel="noopener noreferrer">Visit business website ↗</a>}</section>
    <div className="section-heading compact-heading"><div><p className="eyebrow">PUBLISHED OFFERS</p><h2>Products and services from this business</h2></div></div>
    {listings.length ? <div className="listing-grid">{listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="empty-state"><p>This business has no approved offers published at present.</p><Link href="/request" className="button">Submit a sourcing request</Link></div>}
    <p className="fine-print">RNX approval means the business application passed its review process. Independently confirm the exact goods or services, specifications, price, licences, availability and fulfilment terms.</p>
  </main>;
}
