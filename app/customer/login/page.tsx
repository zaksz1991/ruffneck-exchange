import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerAuthForm } from '@/components/customer-auth-form';

export const metadata: Metadata = {
  title: 'Customer Sign In',
  robots: { index: false, follow: false },
  alternates: { canonical: '/customer/login' },
};

export default function CustomerLoginPage() {
  return <main className="page-shell container narrow-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER ACCOUNT</p><h1>Sign in to your account.</h1><p>Track requests submitted while signed in and continue conversations with RNX Operations.</p></div>
    <CustomerAuthForm mode="login" />
    <p className="fine-print"><Link href="/account/recovery?type=customer">Forgot your password?</Link></p>
    <p className="fine-print">New to RuffNeck Exchange? <Link href="/customer/register">Create a customer account</Link>.</p>
    <p className="fine-print">Guest request tracking remains available through the private link shown after submission.</p>
  </main>;
}
