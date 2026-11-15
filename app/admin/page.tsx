import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';
import { AdminConsole } from '@/components/admin-console';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await hasAdminSession())) redirect('/admin/login');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro admin-page-intro">
      <p className="eyebrow">PRIVATE OPERATIONS</p>
      <h1>Marketplace operations.</h1>
      <p>Review suppliers and listings, qualify customer requests, answer customer messages, prepare anonymised supplier offers, verify payments and record customer-authorised introductions.</p>
    </div>
    <p className="admin-page-links"><Link className="button button-small" href="/admin/analytics">Acquisition analytics</Link> <Link className="button button-small" href="/admin/memberships">Membership and supplier portal operations</Link> <Link className="button button-small button-dark" href="/admin/communications">Customer communications</Link></p><AdminConsole />
  </main>;
}
