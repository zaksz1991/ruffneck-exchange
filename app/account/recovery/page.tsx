import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountRecoveryRequestForm } from '@/components/account-recovery-form';

type Props = { searchParams: Promise<{ type?: string | string[] }> };
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Password Recovery',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function AccountRecoveryPage({ searchParams }: Props) {
  const params = await searchParams;
  const value = Array.isArray(params.type) ? params.type[0] : params.type;
  const accountType = value === 'supplier' ? 'supplier' : 'customer';
  const label = accountType === 'supplier' ? 'supplier portal' : 'customer';
  const signInPath = accountType === 'supplier' ? '/supplier/login' : '/customer/login';

  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Reset your {label} password.</h1><p>Enter the email address registered to your account. Eligible accounts receive a one-time reset link by email.</p></div>
    <AccountRecoveryRequestForm accountType={accountType} />
    <p className="fine-print"><Link href={signInPath}>Return to sign in</Link></p>
  </main>;
}
