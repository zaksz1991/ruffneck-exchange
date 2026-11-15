import type { Metadata } from 'next';
import { AccountPasswordResetForm } from '@/components/account-recovery-form';

type Props = { searchParams: Promise<{ type?: string | string[]; token?: string | string[] }> };
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Set a New Password',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function AccountResetPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const accountType = rawType === 'supplier' ? 'supplier' : 'customer';
  const token = typeof rawToken === 'string' && /^[a-f0-9]{64}$/i.test(rawToken) ? rawToken : '';
  const label = accountType === 'supplier' ? 'supplier portal' : 'customer';

  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Choose a new {label} password.</h1><p>Use a strong password that you do not use on another service.</p></div>
    <AccountPasswordResetForm token={token} accountType={accountType} />
  </main>;
}
