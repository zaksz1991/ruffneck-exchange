import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';
import { AdminMembershipConsole } from '@/components/admin-membership-console';
export const metadata: Metadata = { title: 'Membership Operations', robots: { index: false, follow: false, noarchive: true } };
export const dynamic = 'force-dynamic';
export default async function AdminMembershipsPage() {
  if (!(await hasAdminSession())) redirect('/admin/login');
  return <main className="page-shell container admin-page-shell"><div className="page-intro admin-page-intro"><p className="eyebrow">PRIVATE OPERATIONS</p><h1>Supplier membership operations.</h1><p>Review membership requests, issue quotations, verify receiving-account payment evidence and activate approved plans. This is manual billing; no payment gateway is connected.</p><p><Link href="/admin">← Back to marketplace operations</Link></p></div><AdminMembershipConsole /></main>;
}
