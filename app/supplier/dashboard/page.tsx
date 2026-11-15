import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { hasSupplierSession } from '@/lib/supplier-auth';
import { SupplierDashboard } from '@/components/supplier-dashboard';

export const metadata: Metadata = { title: 'Supplier Dashboard', robots: { index: false, follow: false, noarchive: true } };
export const dynamic = 'force-dynamic';
export default async function SupplierDashboardPage() {
  if (!(await hasSupplierSession())) redirect('/supplier/login');
  return <main className="page-shell container supplier-page-shell"><div className="page-intro"><p className="eyebrow">BUSINESS WORKSPACE</p><h1>Supplier dashboard.</h1><p>Manage catalogue submissions, membership and customer opportunity workflows.</p></div><SupplierDashboard /></main>;
}
