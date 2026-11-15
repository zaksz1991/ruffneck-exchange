import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';
import { AdminLoginForm } from '@/components/admin-login-form';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect('/admin');
  return <main className="page-shell container admin-login-shell">
    <section className="admin-login-card">
      <p className="eyebrow">RUFFNECK EXCHANGE · PRIVATE</p>
      <h1>Operations sign-in</h1>
      <p className="muted">This area is restricted to authorised RNX operators. Supplier and customer contact information is visible only after sign-in.</p>
      <AdminLoginForm />
      <p className="admin-security-note">Do not share the administrator password. Configure the access credentials as server-only environment variables in Vercel.</p>
    </section>
  </main>;
}
