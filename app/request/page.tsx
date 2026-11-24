import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestForm } from '@/components/request-form';
import { getApprovedListingBySlug } from '@/lib/catalog';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Submit a Free Sourcing Request',
  description: 'Tell RuffNeck Exchange what product, service or procurement requirement you need fulfilled.',
  alternates: { canonical: '/request' },
};

type SearchParams = { requirement?: string | string[]; category?: string | string[]; state?: string | string[]; listing?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export default async function RequestPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawListingSlug = first(params.listing).trim().slice(0, 180);
  const safeListingSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawListingSlug) ? rawListingSlug : '';
  const referencedListing = safeListingSlug ? await getApprovedListingBySlug(safeListingSlug, { includeImage: false }) : null;
  const initialCategory = (first(params.category) || first(params.requirement) || referencedListing?.category || '').trim().slice(0, 100);
  const requestedState = first(params.state).trim();
  // URL state values and listing records are both checked against the supported state list.
  const supportedStates = new Set<string>(site.states);
  const initialState = supportedStates.has(requestedState)
    ? requestedState
    : referencedListing && supportedStates.has(referencedListing.state) ? referencedListing.state : '';
  const initialRequestType = referencedListing?.listing_type === 'service'
    ? 'service'
    : referencedListing?.listing_type === 'wholesale' ? 'bulk' : 'product';

  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER REQUEST</p><h1>Tell us what you need.</h1><p>Submitting a request is free. Give us enough detail to understand your requirement, location and timing. Your contact details are not released to a supplier without an authorised introduction.</p></div>
    {referencedListing ? <div className="notice listing-enquiry-context">
      <strong>Enquiry about a published RNX offer</strong>
      <p>{referencedListing.title} · Listed by {referencedListing.supplier.business_name}</p>
      <p>This reference helps RNX identify the offer you viewed. It does not confirm current stock, final pricing or supplier acceptance.</p>
      <Link className="text-link" href={`/marketplace/listing/${referencedListing.slug}`}>Review published offer ↗</Link>
    </div> : rawListingSlug ? <div className="notice"><strong>This published offer is no longer available.</strong><p>You can still submit a general sourcing request below. RNX will review the requirement independently.</p></div> : null}
    <RequestForm
      initialCategory={initialCategory}
      initialState={initialState}
      initialRequestType={initialRequestType}
      referencedListing={referencedListing ? { slug: referencedListing.slug, title: referencedListing.title, supplierName: referencedListing.supplier.business_name } : undefined}
    />
  </main>;
}
