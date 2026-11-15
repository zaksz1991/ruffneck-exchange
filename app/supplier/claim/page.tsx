import type { Metadata } from 'next';
import { SupplierClaimForm } from '@/components/supplier-claim-form';

export const metadata: Metadata = { title: 'Activate Supplier Portal', robots: { index: false, follow: false, noarchive: true }, referrer: 'no-referrer' };
export default async function SupplierClaimPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return <main className="page-shell container narrow-shell"><div className="page-intro"><p className="eyebrow">SUPPLIER PORTAL ACTIVATION</p><h1>Set your portal password.</h1><p>This secure activation link is for an approved RNX supplier. It can be used once and expires seven days after issue.</p></div>{token.length === 64 && /^[a-f0-9]{64}$/i.test(token) ? <SupplierClaimForm token={token} /> : <div className="form-card"><p className="form-error">Activation token is missing or invalid. Contact RNX operations for a new link.</p></div>}</main>;
}
