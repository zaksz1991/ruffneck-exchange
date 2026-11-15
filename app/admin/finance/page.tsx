import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminFinanceConsole } from '@/components/admin-finance-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lead Fee Finance', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminFinancePage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'payments:verify')) redirect('/admin/forbidden');
  const backHref = hasPermission(session.role, 'memberships:read') ? '/admin/memberships' : '/';
  return <main className="page-shell container admin-page-shell"><div className="page-intro"><p className="eyebrow">PRIVATE FINANCE</p><h1>Lead-fee reconciliation.</h1><p>Review supplier payment for anonymised opportunities without exposing customer contact information. Verify receipts against the actual receiving-account record.</p></div><p className="admin-page-links"><Link className="button button-small button-dark" href={backHref}>Back</Link></p><AdminFinanceConsole /></main>;
}
