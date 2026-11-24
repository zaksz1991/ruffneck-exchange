import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminCommercialQuoteConsole } from '@/components/admin-commercial-quote-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Commercial Quotations', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminCommercialQuotesPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'operations:read')) redirect('/admin/forbidden');

  return <main className="page-shell container admin-page-shell">
    <div className="page-intro">
      <p className="eyebrow">PRIVATE OPERATIONS · {session.fullName} · {session.role.replaceAll('_', ' ')}</p>
      <h1>Commercial quotation oversight.</h1>
      <p>Monitor supplier proposals submitted after authorised introductions. Review quote status, supplier identity, commercial terms and the recorded decision history. RNX quote monitoring does not make RNX a party to the supplier-customer contract.</p>
    </div>
    <p className="admin-page-links"><Link className="button button-small button-dark" href="/admin">Back to operations</Link></p>
    <AdminCommercialQuoteConsole />
  </main>;
}
