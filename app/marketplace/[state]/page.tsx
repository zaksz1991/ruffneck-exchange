import Link from 'next/link';
import { site } from '@/lib/site';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return site.states.map((state) => ({
    state: state.toLowerCase().replaceAll(' ', '-'),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const stateName = site.states.find(
    (item) => item.toLowerCase().replaceAll(' ', '-') === state,
  );

  if (!stateName) return { title: 'Marketplace location not found' };

  return {
    title: `Businesses, Products and Services in ${stateName}`,
    description: `Explore marketplace categories and submit product or service requests for ${stateName}. Supplier coverage is confirmed individually.`,
    robots: { index: false, follow: true },
  };
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const stateName = site.states.find(
    (item) => item.toLowerCase().replaceAll(' ', '-') === state,
  );

  if (!stateName) notFound();

  return (
    <main className="page">
      <p className="eyebrow">MARKETPLACE LOCATION</p>
      <h1>Products, services and supplier requests in {stateName}</h1>
      <p>
        Tell RuffNeck Exchange what you need in {stateName}. The team can review
        the requirement and identify relevant businesses where suitable
        supplier coverage exists.
      </p>
      <div className="notice">
        This location page is a starting point, not a claim that suppliers,
        inventory or verified businesses are already available in this state.
        Search engines are asked not to index this page until unique local
        research and genuine supplier coverage have been added.
      </div>
      <Link className="button" href="/request">
        Request a product or service
      </Link>
    </main>
  );
}
