import type { Metadata } from 'next';
import { SupplierForm } from '@/components/supplier-form';
export const metadata: Metadata = { title: 'Register Your Business', description: 'Apply to participate as a manufacturer, wholesaler, distributor, retailer or service provider on RuffNeck Exchange.', alternates: { canonical: '/business/register' } };
export default function RegisterBusinessPage() { return <main className="page-shell container narrow-shell"><div className="page-intro"><p className="eyebrow">BUSINESS PARTICIPATION</p><h1>Put your business in the exchange.</h1><p>Submit your business details for review. An application is not an approval, verified badge, guaranteed lead volume or ranking commitment.</p></div><SupplierForm /></main>; }
