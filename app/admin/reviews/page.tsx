import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminReviewConsole } from '@/components/admin-review-console';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'trust:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER TRUST · {session.fullName} · {session.role.replaceAll('_', ' ')}</p><h1>Verified supplier reviews.</h1><p>Moderate customer feedback backed by independently recorded completion confirmations from both sides of a supplier introduction. Only approved reviews appear on public supplier profiles.</p></div>
    <p className="admin-page-links"><Link className="button button-small button-dark" href={hasPermission(session.role, 'operations:read') ? '/admin' : '/admin/trust'}>Back to authorised operations</Link></p>
    <AdminReviewConsole canWrite={hasPermission(session.role, 'trust:write')} />
  </main>;
}
