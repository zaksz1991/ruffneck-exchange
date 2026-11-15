import Link from 'next/link';
import type { Metadata } from 'next';
import { getApprovedSuppliers } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Approved Suppliers', description: 'Browse businesses approved for public representation on RuffNeck Exchange.', alternates: { canonical: '/suppliers' } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };
export default async function SuppliersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? '';
  const suppliers = await getApprovedSuppliers(q);
  return <main className="page-shell container">
    <div className="page-intro"><p className="eyebrow">BUSINESS NETWORK</p><h1>Explore approved suppliers.</h1><p>These businesses have been approved for public representation on RuffNeck Exchange. Approval is not a guarantee of every product, licence, stock position, price or transaction. Carry out appropriate checks before committing funds.</p></div>
    <form action="/suppliers" className="market-search" role="search"><label className="sr-only" htmlFor="supplier-q">Search suppliers</label><input id="supplier-q" name="q" defaultValue={q} placeholder="Search business name, category or state" /><button className="button" type="submit">Search suppliers</button></form>
    {suppliers.length ? <div className="supplier-grid">{suppliers.map(supplier => <article className="supplier-card" key={supplier.id}><span className="listing-type">APPROVED BUSINESS</span><h2>{supplier.business_name}</h2><p className="supplier-kind">{supplier.business_type} · {supplier.category}</p><p>{supplier.description.length > 190 ? `${supplier.description.slice(0, 190).trim()}…` : supplier.description}</p><div className="listing-meta"><span>{supplier.state}</span></div><Link className="card-arrow" href={`/suppliers/${supplier.public_slug}`}>View business and offers ↗</Link></article>)}</div> : <div className="empty-state"><h2>No approved supplier profiles found.</h2><p>New business applications are reviewed before public listing.</p><Link className="button" href="/business/register">Register your business</Link></div>}
  </main>;
}
