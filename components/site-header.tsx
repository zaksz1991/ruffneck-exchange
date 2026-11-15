import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="RuffNeck Exchange home">
          <span className="brand-mark">R</span>
          <span className="brand-copy"><strong>RUFFNECK</strong><small>EXCHANGE</small></span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/suppliers">Suppliers</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/plans">Supplier plans</Link>
          <Link href="/supplier/login">Supplier portal</Link>
          <Link href="/customer/login">Customer account</Link>
          <Link href="/ruffneck">RuffNeck products</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="header-actions">
          <Link href="/business/register" className="nav-supplier">For businesses</Link>
          <Link href="/request" className="button button-small">Post a request</Link>
        </div>
      </div>
    </header>
  );
}
