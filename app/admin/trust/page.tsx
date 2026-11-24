import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminTrustConsole } from '@/components/admin-trust-console';

export const dynamic = 'force-dynamic';

export default async function AdminTrustPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'trust:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER PROTECTION · {session.fullName} · {session.role.replaceAll('_', ' ')}</p><h1>Trust, complaints and resolution.</h1><p>Review reports raised through private request-tracking links, assign ownership, record internal notes and send customer-visible updates. Case handling does not establish legal liability or guarantee a commercial outcome.</p></div>
    <p className="admin-page-links"><Link className="button button-small button-dark" href={hasPermission(session.role, 'operations:read') ? '/admin' : '/admin/communications'}>Back to authorised operations</Link> <Link className="button button-small" href="/admin/reviews">Verified supplier reviews</Link></p>
    <AdminTrustConsole canWrite={hasPermission(session.role, 'trust:write')} />
  </main>;
}
