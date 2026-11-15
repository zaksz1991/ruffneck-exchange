import type { Metadata } from 'next';
import { AdminStaffAcceptForm } from '@/components/admin-staff-accept-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Accept Staff Invitation', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminStaffAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <main className="page-shell container admin-login-shell"><section className="admin-login-card">
    <p className="eyebrow">RUFFNECK EXCHANGE · STAFF</p>
    <h1>Activate your staff account.</h1>
    <p className="muted">Create a private password to accept your single-use RNX staff invitation. Invitations expire 48 hours after creation.</p>
    <AdminStaffAcceptForm token={params.token || ''} />
    <p className="admin-security-note">Never forward this invitation link. RNX staff accounts must not be shared.</p>
  </section></main>;
}
