import Link from 'next/link';
import { departments, site } from '@/lib/site';
import { getApprovedListings } from '@/lib/catalog';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Marketplace — Products, Services and Business Categories',
  description: 'Explore approved supplier offers, business categories and sourcing opportunities across Nigeria.',
  alternates: { canonical: '/marketplace' },
};

type Params = { q?: string | string[]; state?: string | string[]; category?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const norm = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');

export default async function Marketplace({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const category = first(params.category).trim();
  const state = first(params.state).trim();
  const phrase = norm([q, category].filter(Boolean).join(' '));
  const terms = phrase.split(/[^a-z0-9]+/).filter((term) => term.length > 1);
  const matches = terms.length ? departments.filter((department) => {
    const haystack = norm([department.name, department.description, ...department.keywords].join(' '));
    return terms.some((term) => haystack.includes(term));
  }) : departments;
  const listings = await getApprovedListings({ q, state, category, limit: 100 });

  return <main className="page-shell container">
    <div className="page-intro">
      <p className="eyebrow">RNX MARKETPLACE</p>
      <h1>Explore products, services and business categories.</h1>
      <p>Search approved offers where suppliers have passed review, or submit a requirement for sourcing support. An approved listing is not a guarantee of stock or final pricing; confirm details with RNX before proceeding.</p>
    </div>

    <form action="/marketplace" className="market-search" role="search">
      <label className="sr-only" htmlFor="market-q">Search approved offers and categories</label>
      <input id="market-q" name="q" defaultValue={q} placeholder="Search products, services or categories" />
      {category && <input type="hidden" name="category" value={category} />}
      <label className="sr-only" htmlFor="market-state">State</label>
      <select id="market-state" name="state" defaultValue={state}>
        <option value="">All Nigeria</option>
        {site.states.map((item) => <option key={item}>{item}</option>)}
      </select>
      <button className="button" type="submit">Search</button>
    </form>

    {state && <p className="notice">Location filter: <strong>{state}</strong>. Only approved listings in this location are shown. Supplier coverage outside published listings is confirmed individually.</p>}

    <section aria-labelledby="live-listings-heading">
      <div className="section-heading compact-heading">
        <div><p className="eyebrow">APPROVED INVENTORY</p><h2 id="live-listings-heading">Products and services currently published</h2></div>
        <Link className="text-link" href="/suppliers">Browse approved suppliers ↗</Link>
      </div>
      {listings.length ? <div className="listing-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="empty-state">
        <span className="listing-type">RNX SOURCING DESK</span>
        <h3>{q || category || state ? 'No approved offers match these filters yet.' : 'Your requirement can be sourced even when it is not listed here.'}</h3>
        <p>RNX is building its approved supplier catalogue. Submit the product, service or procurement requirement you need; the operations team can review the brief and assess suitable suppliers. Submitting a customer request is free and does not commit you to a purchase.</p>
        <div className="hero-links">
          <Link className="button" href={`/request${q || category || state ? `?${new URLSearchParams({ ...(q ? { requirement: q } : {}), ...(category ? { category } : {}), ...(state ? { state } : {}) }).toString()}` : ''}`}>Submit a free sourcing request</Link>
          <Link className="text-link" href="/business/register">I supply products or services ↗</Link>
        </div>
        <p className="fine-print">Only approved supplier and listing records appear as public inventory. Customer contact details are not released to suppliers without the required payment verification and customer permission.</p>
      </div>}
    </section>

    <div className="section-heading compact-heading">
      <div><p className="eyebrow">CATEGORY DISCOVERY</p><h2>{phrase ? `${matches.length} relevant ${matches.length === 1 ? 'category' : 'categories'}` : 'Browse by department'}</h2></div>
      <span className="muted">{departments.length} departments</span>
    </div>
    {matches.length ? <div className="category-grid">{matches.map((department, index) => <Link key={department.slug} className="category-card" href={`/marketplace?category=${encodeURIComponent(department.name)}${state ? `&state=${encodeURIComponent(state)}` : ''}`}>
      <span className="category-index">{String(index + 1).padStart(2, '0')}</span><h3>{department.name}</h3><p>{department.description}</p><span className="card-arrow">View sourcing category ↗</span>
    </Link>)}</div> : <div className="empty-state"><h3>No exact category match</h3><p>Your requirement may still be handled. Describe what you need and the team can review it.</p><Link className="button" href="/request">Submit a sourcing request</Link></div>}

    <section className="state-section">
      <div className="section-heading compact-heading"><div><p className="eyebrow">LOCATION EXPLORER</p><h2>Browse by state</h2></div></div>
      <div className="state-grid">{site.states.map((item) => <Link key={item} href={`/marketplace/${item.toLowerCase().replace(/\s+/g, '-')}`}>{item}</Link>)}</div>
    </section>
    <p className="fine-print">Only listings with both an approved supplier application and an approved listing status appear above. Unapproved or incomplete records are never presented as available inventory. Confirm price, specifications, stock and delivery terms before payment.</p>
  </main>;
}
