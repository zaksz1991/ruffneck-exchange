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
      <p>Review suppliers and listings, qualify customer requests, prepare anonymised supplier offers, verify payments and record customer-authorised introductions.</p>
    </div>
    <AdminConsole />
  </main>;
}
