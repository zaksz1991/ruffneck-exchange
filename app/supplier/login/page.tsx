import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { hasSupplierSession } from '@/lib/supplier-auth';
import { SupplierLoginForm } from '@/components/supplier-login-form';

export const metadata: Metadata = { title: 'Supplier Sign In', robots: { index: false, follow: false, noarchive: true } };
export const dynamic = 'force-dynamic';
export default async function SupplierLoginPage() {
  if (await hasSupplierSession()) redirect('/supplier/dashboard');
  return <main className="page-shell container narrow-shell"><div className="page-intro"><p className="eyebrow">SUPPLIER PORTAL</p><h1>Manage your business on RNX.</h1><p>Sign in to manage approved catalogue submissions, membership requests and anonymised customer opportunities.</p></div><SupplierLoginForm /><p className="portal-access-note">Supplier access is enabled after business approval. Existing approved suppliers without a portal password must request an activation link from RNX operations.</p></main>;
}
