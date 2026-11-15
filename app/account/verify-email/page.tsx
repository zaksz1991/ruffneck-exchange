import type { Metadata } from 'next';
import Link from 'next/link';
import { EmailVerificationForm } from '@/components/email-verification-form';
export const metadata: Metadata = {
  title: 'Confirm Email Address',
  description: 'Confirm your email address for RuffNeck Exchange.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';
export default function VerifyEmailPage() {
  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Confirm your email address.</h1><p>Use the one-time link sent to your inbox. Email confirmation protects account access and supplier onboarding.</p></div>
    <EmailVerificationForm />
    <p className="fine-print"><Link href="/customer/login">Customer sign in</Link> · <Link href="/supplier/login">Supplier sign in</Link></p>
  </main>;
}
