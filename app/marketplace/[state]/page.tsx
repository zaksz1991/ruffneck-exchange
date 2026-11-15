import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { site, stateFromSlug } from '@/lib/site';

type Props = { params: Promise<{ state: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state: slug } = await params;
  const state = stateFromSlug(slug);
  if (!state) return { title: 'Location not found', robots: { index: false, follow: true } };
  return { title: `Sourcing Requests in ${state}`, description: `Submit a product, service or procurement request for ${state}. Supplier coverage is confirmed individually.`, alternates: { canonical: `/marketplace/${slug}` }, robots: { index: false, follow: true } };
}

export default async function StateMarketplace({ params }: Props) {
  const { state: slug } = await params;
  const state = stateFromSlug(slug);
  if (!state) notFound();
  return <main className="page-shell container"><div className="breadcrumbs"><Link href="/marketplace">Marketplace</Link><span>/</span><span>{state}</span></div><div className="page-intro"><p className="eyebrow">LOCATION REQUESTS</p><h1>Source products and services in {state}.</h1><p>Tell us what you need and where it is required. The team will review the request and assess relevant supplier coverage; this page does not claim that a supplier or product is currently available.</p><Link className="button" href={`/request?state=${encodeURIComponent(state)}`}>Submit a request for {state}</Link></div><div className="notice"><strong>Location page under development.</strong><p>This page is not indexed until it has unique local market information and verified supplier coverage. It is available as a request entry point.</p></div><div className="state-grid">{site.states.filter(s => s !== state).slice(0, 12).map(s => <Link key={s} href={`/marketplace/${s.toLowerCase().replace(/\s+/g, '-')}`}>{s}</Link>)}</div></main>;
}
