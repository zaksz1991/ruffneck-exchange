import Link from 'next/link';
import { departmentKeywords, departments, site } from '@/lib/site';

export const metadata = {
  title: 'Products, Suppliers and Services Marketplace',
  description:
    'Find products, compare suppliers and request quotations from businesses across Nigeria.',
  alternates: { canonical: '/marketplace' },
};

type MarketplaceSearchParams = {
  q?: string | string[];
  state?: string | string[];
  category?: string | string[];
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const params = await searchParams;
  const query = firstValue(params.q).trim();
  const category = firstValue(params.category).trim();
  const state = firstValue(params.state).trim();
  const searchText = normalize([query, category].filter(Boolean).join(' '));
  const searchTerms = searchText.split(' ').filter((term) => term.length > 1);

  const matchingDepartments = searchTerms.length
    ? departments.filter((department) => {
        const searchableText = normalize(
          [department, ...departmentKeywords[department]].join(' '),
        );
        return searchTerms.some((term) => searchableText.includes(term));
      })
    : departments;

  return (
    <main className="page">
      <p className="eyebrow">MARKETPLACE</p>
      <h1>Browse products, services and businesses</h1>
      <p>
        Search by product, service, supplier category or location. Listings are
        published only after moderation and the relevant verification checks.
      </p>

      <form action="/marketplace" className="search" role="search">
        <label className="sr-only" htmlFor="marketplace-query">
          Product, service or supplier
        </label>
        <input
          id="marketplace-query"
          name="q"
          placeholder="What do you need? e.g. cold room, cement, logistics"
          defaultValue={query}
        />
        <label className="sr-only" htmlFor="marketplace-state">
          State
        </label>
        <select id="marketplace-state" name="state" defaultValue={state}>
          <option value="">All Nigeria</option>
          {site.states.map((stateName) => (
            <option key={stateName} value={stateName}>
              {stateName}
            </option>
          ))}
        </select>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button type="submit">Search marketplace</button>
      </form>

      {state ? (
        <p className="notice">
          Location selected: <strong>{state}</strong>. Supplier coverage and
          availability are confirmed individually; this filter does not imply
          that listings currently exist in that state.
        </p>
      ) : null}

      {searchText ? (
        <p>
          Departments matching <strong>{[query, category].filter(Boolean).join(' · ')}</strong>
        </p>
      ) : (
        <h2>Explore business departments</h2>
      )}

      {matchingDepartments.length > 0 ? (
        <div className="grid">
          {matchingDepartments.map((department) => (
            <Link
              className="tile"
              key={department}
              href={`/marketplace?category=${encodeURIComponent(department)}${state ? `&state=${encodeURIComponent(state)}` : ''}`}
            >
              <h3>{department}</h3>
              <p>Explore this category and request relevant products or services.</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="notice" role="status">
          <strong>No matching department was found.</strong>
          <p>
            Your requirement may still be handled even when it does not match a
            listed department. Submit a free request and describe what you need.
          </p>
          <Link className="button" href="/request">
            Submit a customer request
          </Link>
        </div>
      )}

      <h2>Browse by state</h2>
      <div className="stategrid">
        {site.states.map((stateName) => (
          <Link
            key={stateName}
            href={`/marketplace/${encodeURIComponent(stateName.toLowerCase().replaceAll(' ', '-'))}/`}
          >
            {stateName}
          </Link>
        ))}
      </div>

      <p className="notice">
        Supplier and product inventory will appear as approved businesses
        publish listings. Department matches are taxonomy suggestions, not
        confirmation of stock, supplier availability or completed verification.
      </p>
    </main>
  );
}
