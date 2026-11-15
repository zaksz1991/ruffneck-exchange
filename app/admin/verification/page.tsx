import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminVerificationConsole } from '@/components/admin-verification-console';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'verification:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro"><p className="eyebrow">SUPPLIER ASSURANCE · {session.fullName}</p><h1>Supplier verification.</h1><p>Review supplier declarations and private evidence, record a limited documentary decision and set an expiry date. Access is restricted to authorised verification staff.</p></div>
    <p className="admin-page-links"><Link className="button button-small button-dark" href="/admin">Back to operations</Link></p>
    <AdminVerificationConsole canWrite={hasPermission(session.role, 'verification:write')} />
  </main>;
}
