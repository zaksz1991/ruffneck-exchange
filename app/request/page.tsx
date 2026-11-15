import type { Metadata } from 'next';
import { RequestForm } from '@/components/request-form';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Submit a Free Sourcing Request',
  description: 'Tell RuffNeck Exchange what product, service or procurement requirement you need fulfilled.',
  alternates: { canonical: '/request' },
};

type SearchParams = { requirement?: string | string[]; category?: string | string[]; state?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export default async function RequestPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const initialCategory = (first(params.category) || first(params.requirement)).trim().slice(0, 100);
  const requestedState = first(params.state).trim();
  const initialState = site.states.includes(requestedState) ? requestedState : '';

  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER REQUEST</p><h1>Tell us what you need.</h1><p>Submitting a request is free. Give us enough detail to understand your requirement, location and timing. Your contact details are not released to a supplier without an authorised introduction.</p></div>
    <RequestForm initialCategory={initialCategory} initialState={initialState} />
  </main>;
}
