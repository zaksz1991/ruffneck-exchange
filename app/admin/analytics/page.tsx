import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { AdminAnalytics } from '@/components/admin-analytics';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acquisition Analytics', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminAnalyticsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasPermission(session.role, 'analytics:read')) redirect('/admin/forbidden');
  return <main className="page-shell container admin-page-shell"><div className="page-intro"><p className="eyebrow">PRIVATE OPERATIONS</p><h1>Acquisition and conversion analytics.</h1><p>Understand where requests and supplier applications originate, which categories and locations generate demand, and how verified introductions progress.</p></div><p className="admin-page-links"><Link className="button button-small button-dark" href={hasPermission(session.role, 'operations:read') ? '/admin' : session.role === 'finance' ? '/admin/memberships' : '/'}>Back</Link></p><AdminAnalytics /></main>;
}
