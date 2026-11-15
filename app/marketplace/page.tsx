import Link from 'next/link';
import { departments, site } from '@/lib/site';
import { getApprovedListings } from '@/lib/catalog';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketplace — Products, Services and Business Categories', description: 'Explore approved supplier offers, business categories and sourcing opportunities across Nigeria.', alternates: { canonical: '/marketplace' } };

type Params = { q?: string | string[]; state?: string | string[]; category?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const norm = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');

export default async function Marketplace({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const category = first(params.category).trim();
  const state = first(params.state).trim();
  const phrase = norm([q, category].filter(Boolean).join(' '));
  const terms = phrase.split(/[^a-z0-9]+/).filter(t => t.length > 1);
  const matches = terms.length ? departments.filter(d => {
    const haystack = norm([d.name, d.description, ...d.keywords].join(' '));
    return terms.some(term => haystack.includes(term));
  }) : departments;
  const listings = await getApprovedListings({ q, state, category, limit: 100 });

  return <main className="page-shell container">
    <div className="page-intro"><p className="eyebrow">RNX MARKETPLACE</p><h1>Explore products, services and business categories.</h1><p>Search approved offers where suppliers have passed review, or submit a requirement for sourcing support. An approved listing is not a guarantee of stock or final pricing; confirm details with RNX before proceeding.</p></div>
    <form action="/marketplace" className="market-search" role="search"><label className="sr-only" htmlFor="market-q">Search approved offers and categories</label><input id="market-q" name="q" defaultValue={q} placeholder="Search products, services or categories" /><label className="sr-only" htmlFor="market-state">State</label><select id="market-state" name="state" defaultValue={state}><option value="">All Nigeria</option>{site.states.map(s => <option key={s}>{s}</option>)}</select><button className="button" type="submit">Search</button></form>
    {state && <p className="notice">Location filter: <strong>{state}</strong>. Only approved listings in this location are shown. Supplier coverage outside published listings is confirmed individually.</p>}

    <section aria-labelledby="live-listings-heading">
      <div className="section-heading compact-heading"><div><p className="eyebrow">APPROVED INVENTORY</p><h2 id="live-listings-heading">Products and services currently published</h2></div><Link className="text-link" href="/suppliers">Browse approved suppliers ↗</Link></div>
      {listings.length ? <div className="listing-grid">{listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="empty-state"><h3>No approved listings match this search yet.</h3><p>That does not mean the product or service is unavailable. Send a sourcing request and RNX can assess the requirement.</p><Link className="button" href="/request">Submit a sourcing request</Link></div>}
    </section>

    <div className="section-heading compact-heading"><div><p className="eyebrow">CATEGORY DISCOVERY</p><h2>{phrase ? `${matches.length} relevant ${matches.length === 1 ? 'category' : 'categories'}` : 'Browse by department'}</h2></div><span className="muted">{departments.length} departments</span></div>
    {matches.length ? <div className="category-grid">{matches.map((d, i) => <Link key={d.slug} className="category-card" href={`/marketplace?category=${encodeURIComponent(d.name)}${state ? `&state=${encodeURIComponent(state)}` : ''}`}><span className="category-index">{String(i + 1).padStart(2, '0')}</span><h3>{d.name}</h3><p>{d.description}</p><span className="card-arrow">View sourcing category ↗</span></Link>)}</div> : <div className="empty-state"><h3>No exact category match</h3><p>Your requirement may still be handled. Describe what you need and the team can review it.</p><Link className="button" href="/request">Submit a sourcing request</Link></div>}
    <section className="state-section"><div className="section-heading compact-heading"><div><p className="eyebrow">LOCATION EXPLORER</p><h2>Browse by state</h2></div></div><div className="state-grid">{site.states.map(s => <Link key={s} href={`/marketplace/${s.toLowerCase().replace(/\s+/g, '-')}`}>{s}</Link>)}</div></section>
    <p className="fine-print">Only listings with both an approved supplier application and an approved listing status appear above. Unapproved or incomplete records are never presented as available inventory. Confirm price, specifications, stock and delivery terms before payment.</p>
  </main>;
}
