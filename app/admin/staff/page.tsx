import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminStaffConsole } from '@/components/admin-staff-console';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'staff:manage')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro"><p className="eyebrow">OWNER CONTROL</p><h1>Staff access and accountability.</h1><p>Invite team members, assign operational roles, suspend access and review the recent administrative activity trail.</p></div>
    <p className="admin-page-links"><Link className="button button-small button-dark" href="/admin">Back to operations</Link></p>
    <AdminStaffConsole />
  </main>;
}
