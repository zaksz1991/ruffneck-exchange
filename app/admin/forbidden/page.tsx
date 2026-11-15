import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminForbiddenPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  const links: Array<{ href: string; label: string }> = [];
  if (hasPermission(session.role, 'operations:read')) links.push({ href: '/admin', label: 'Marketplace operations' });
  if (hasPermission(session.role, 'communications:read')) links.push({ href: '/admin/communications', label: 'Customer communications' });
  if (hasPermission(session.role, 'memberships:read')) links.push({ href: '/admin/memberships', label: 'Membership operations' });
  if (hasPermission(session.role, 'analytics:read')) links.push({ href: '/admin/analytics', label: 'Acquisition analytics' });
  return <main className="page-shell container admin-login-shell"><section className="admin-login-card"><p className="eyebrow">ROLE-RESTRICTED AREA</p><h1>Access not permitted.</h1><p className="muted">Your current role ({session.role.replaceAll('_',' ')}) does not grant access to this page. Contact the RNX owner if your responsibilities have changed.</p><div className="admin-page-links">{links.map((item) => <Link className="button button-small" key={item.href} href={item.href}>{item.label}</Link>)}</div></section></main>;
}
