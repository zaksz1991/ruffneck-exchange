import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CommercialQuoteDocument } from '@/components/commercial-quote-document';
import { currentCustomerId } from '@/lib/customer-auth';
import { loadCommercialQuoteDocument } from '@/lib/commercial-quote-document';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Commercial Quotation Document',
  robots: { index: false, follow: false, noarchive: true },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageContext = { params: Promise<{ id: string }> };

export default async function CustomerCommercialQuoteDocumentPage({ params }: PageContext) {
  const customerId = await currentCustomerId();
  if (!customerId) redirect('/customer/login');

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const data = await loadCommercialQuoteDocument(id, 'customer', customerId);
  if (!data) notFound();

  return <CommercialQuoteDocument data={data} audience="customer" />;
}
