import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Operations Console', template: '%s | RNX Operations' },
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="admin-area">{children}</div>;
}
