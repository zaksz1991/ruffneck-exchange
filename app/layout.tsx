import type { Metadata, Viewport } from 'next';
import './globals.css';
import { site } from '@/lib/site';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'RuffNeck Exchange | Products, Services, Businesses and Opportunities', template: '%s | RuffNeck Exchange' },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: site.url, siteName: site.name, title: 'RuffNeck Exchange', description: site.description },
  twitter: { card: 'summary_large_image', title: 'RuffNeck Exchange', description: site.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101512' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader /><div className="site-main">{children}</div><SiteFooter /></body></html>;
}
