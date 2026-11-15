import Link from 'next/link';
import { departments, site } from '@/lib/site';

export const metadata = { title: 'Marketplace — Products, Services and Business Categories', description: 'Explore business categories and submit product, service and procurement requests across Nigeria.', alternates: { canonical: '/marketplace' } };

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
    return terms.every(term => haystack.includes(term)) || terms.some(term => haystack.includes(term));
  }) : departments;

  return <main className="page-shell container">
    <div className="page-intro"><p className="eyebrow">RNX MARKETPLACE</p><h1>Explore products, services and business categories.</h1><p>Search the marketplace taxonomy or submit a requirement for sourcing support. Category matches are not live-stock or supplier-availability claims.</p></div>
    <form action="/marketplace" className="market-search" role="search"><label className="sr-only" htmlFor="market-q">Search categories</label><input id="market-q" name="q" defaultValue={q} placeholder="Search products, services or categories" /><label className="sr-only" htmlFor="market-state">State</label><select id="market-state" name="state" defaultValue={state}><option value="">All Nigeria</option>{site.states.map(s => <option key={s}>{s}</option>)}</select><button className="button" type="submit">Search</button></form>
    {state && <p className="notice">Location filter: <strong>{state}</strong>. Supplier coverage and availability are confirmed individually. This filter does not imply approved suppliers currently operate in that location.</p>}
    <div className="section-heading compact-heading"><div><p className="eyebrow">{phrase ? 'SEARCH RESULTS' : 'ALL DEPARTMENTS'}</p><h2>{phrase ? `${matches.length} relevant ${matches.length === 1 ? 'category' : 'categories'}` : 'Browse by department'}</h2></div><span className="muted">{departments.length} departments</span></div>
    {matches.length ? <div className="category-grid">{matches.map((d, i) => <Link key={d.slug} className="category-card" href={`/marketplace?category=${encodeURIComponent(d.name)}${state ? `&state=${encodeURIComponent(state)}` : ''}`}><span className="category-index">{String(i + 1).padStart(2, '0')}</span><h3>{d.name}</h3><p>{d.description}</p><span className="card-arrow">View sourcing category ↗</span></Link>)}</div> : <div className="empty-state"><h3>No exact category match</h3><p>Your requirement may still be handled. Describe what you need and the team can review it.</p><Link className="button" href="/request">Submit a sourcing request</Link></div>}
    <section className="state-section"><div className="section-heading compact-heading"><div><p className="eyebrow">LOCATION EXPLORER</p><h2>Browse by state</h2></div></div><div className="state-grid">{site.states.map(s => <Link key={s} href={`/marketplace/${s.toLowerCase().replace(/\s+/g, '-')}`}>{s}</Link>)}</div></section>
    <p className="fine-print">Listings are not yet published as a verified live inventory. Businesses are reviewed before being represented as approved. Never pay a supplier solely on the basis of an unverified marketplace claim.</p>
  </main>;
}
