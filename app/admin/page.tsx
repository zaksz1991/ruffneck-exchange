import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminConsole } from '@/components/admin-console';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'operations:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro admin-page-intro">
      <p className="eyebrow">PRIVATE OPERATIONS · {session.fullName} · {session.role.replaceAll('_', ' ')}</p>
      <h1>Marketplace operations.</h1>
      <p>Review suppliers and listings, qualify customer requests, answer customer messages, prepare anonymised supplier offers, verify payments and record customer-authorised introductions.</p>
    </div>
    <p className="admin-page-links"><Link className="button button-small" href="/admin/analytics">Acquisition analytics</Link> <Link className="button button-small" href="/admin/memberships">Membership operations</Link> <Link className="button button-small" href="/admin/finance">Lead-fee finance</Link> <Link className="button button-small button-dark" href="/admin/communications">Customer communications</Link> {hasPermission(session.role, 'trust:read') && <Link className="button button-small" href="/admin/trust">Trust & resolution</Link>} {hasPermission(session.role, 'trust:read') && <Link className="button button-small" href="/admin/reviews">Verified reviews</Link>} {hasPermission(session.role, 'verification:read') && <Link className="button button-small" href="/admin/verification">Supplier verification</Link>} {session.role === 'owner' && <Link className="button button-small" href="/admin/staff">Staff access</Link>}</p><AdminConsole />
  </main>;
}
