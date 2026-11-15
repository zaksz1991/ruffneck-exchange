import type { Metadata } from 'next';
import { IntroductionApproval } from '@/components/introduction-approval';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Review Supplier Introduction',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function IntroductionApprovalPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <IntroductionApproval token={params.token || ''} />;
}
