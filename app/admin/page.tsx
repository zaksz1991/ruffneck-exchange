import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';
import { AdminConsole } from '@/components/admin-console';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await hasAdminSession())) redirect('/admin/login');
  return <main className="page-shell container admin-page-shell">
    <div className="page-intro admin-page-intro">
      <p className="eyebrow">PRIVATE OPERATIONS</p>
      <h1>Marketplace operations.</h1>
      <p>Review supplier applications, approve catalogue offers and manage the lead qualification queue. Public visibility and customer contact release remain separate controls.</p>
    </div>
    <AdminConsole />
  </main>;
}
