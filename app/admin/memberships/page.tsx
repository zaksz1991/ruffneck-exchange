import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminMembershipConsole } from '@/components/admin-membership-console';
export const metadata: Metadata = { title: 'Membership Operations', robots: { index: false, follow: false, noarchive: true } };
export const dynamic = 'force-dynamic';
export default async function AdminMembershipsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'memberships:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell"><div className="page-intro admin-page-intro"><p className="eyebrow">PRIVATE OPERATIONS</p><h1>Supplier membership operations.</h1><p>Review membership requests, issue quotations, verify receiving-account payment evidence and activate approved plans. This is manual billing; no payment gateway is connected.</p><p><Link href={hasPermission(session.role, 'operations:read') ? '/admin' : '/admin/analytics'}>← Back to authorised operations</Link></p></div><p className="admin-page-links"><Link className="button button-small" href="/admin/finance">Lead-fee payment reconciliation</Link></p><AdminMembershipConsole /></main>;
}
