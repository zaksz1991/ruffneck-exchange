import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { AdminLoginForm } from '@/components/admin-login-form';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect(session.role === 'support' ? '/admin/communications' : session.role === 'finance' ? '/admin/memberships' : session.role === 'analyst' ? '/admin/analytics' : '/admin');
  return <main className="page-shell container admin-login-shell">
    <section className="admin-login-card">
      <p className="eyebrow">RUFFNECK EXCHANGE · PRIVATE</p>
      <h1>Operations sign-in</h1>
      <p className="muted">Staff members use their invited email and password. Leave the email field blank only when using the owner recovery password. Access is restricted by assigned role.</p>
      <AdminLoginForm />
      <p className="admin-security-note">Never share a staff account or invitation link. The environment-password owner recovery sign-in should be restricted to the RNX owner.</p>
    </section>
  </main>;
}
