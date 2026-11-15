import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';
import { AdminAnalytics } from '@/components/admin-analytics';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acquisition Analytics', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminAnalyticsPage() {
  if (!(await hasAdminSession())) redirect('/admin/login');
  return <main className="page-shell container admin-page-shell"><div className="page-intro"><p className="eyebrow">PRIVATE OPERATIONS</p><h1>Acquisition and conversion analytics.</h1><p>Understand where requests and supplier applications originate, which categories and locations generate demand, and how verified introductions progress.</p></div><p className="admin-page-links"><Link className="button button-small button-dark" href="/admin">Back to operations</Link></p><AdminAnalytics /></main>;
}
