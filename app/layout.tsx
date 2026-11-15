import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { site } from '@/lib/site';
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'RuffNeck Exchange | Products, Services & Business Connections', template: '%s | RuffNeck Exchange' },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: 'website', siteName: site.name, title: site.name, description: site.description },
  twitter: { card: 'summary_large_image', title: site.name, description: site.description },
  robots: { index: true, follow: true }
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body><header className="top"><Link className="brand" href="/">RUFFNECK <b>EXCHANGE</b><small>RNX</small></Link><nav><Link href="/marketplace">Marketplace</Link><Link href="/business/register">List a business</Link><Link href="/ruffneck">RuffNeck ecosystem</Link></nav></header>{children}<footer><b>RuffNeck Exchange</b><p>Products. Services. Businesses. Opportunities.</p><p>Independent marketplace and customer-acquisition intermediary. Listings are subject to review.</p></footer></body></html>;
}
