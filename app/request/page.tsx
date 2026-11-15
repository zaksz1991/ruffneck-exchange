import type { Metadata } from 'next';
import { RequestForm } from '@/components/request-form';
export const metadata: Metadata = { title: 'Submit a Free Sourcing Request', description: 'Tell RuffNeck Exchange what product, service or procurement requirement you need fulfilled.', alternates: { canonical: '/request' } };
export default function RequestPage() { return <main className="page-shell container narrow-shell"><div className="page-intro"><p className="eyebrow">CUSTOMER REQUEST</p><h1>Tell us what you need.</h1><p>Submitting a request is free. Give us enough detail to understand your requirement, location and timing. Your contact details are not released to a supplier without an authorised introduction.</p></div><RequestForm /></main>; }
