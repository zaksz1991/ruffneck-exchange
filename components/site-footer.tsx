import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" className="brand footer-brand"><span className="brand-mark">R</span><span className="brand-copy"><strong>RUFFNECK</strong><small>EXCHANGE</small></span></Link>
          <p className="footer-note">Products. Services. Businesses. Opportunities.</p>
          <p className="muted">An independent customer-acquisition marketplace by RuffNeck Entertainment.</p>
        </div>
        <div><h3>Explore</h3><Link href="/marketplace">Marketplace</Link><Link href="/suppliers">Approved suppliers</Link><Link href="/how-it-works">How it works</Link><Link href="/ruffneck">RuffNeck products</Link></div>
        <div><h3>Participate</h3><Link href="/request">Submit a request</Link><Link href="/business/register">Register a business</Link><Link href="/about">About RNX</Link></div>
        <div><h3>Policies</h3><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:support@ruffneck-entertainment.com">Contact</a></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} RuffNeck Exchange</span><span>Built for Nigeria, designed to scale globally.</span><Link href="/admin/login" rel="nofollow">Operator access</Link></div>
    </footer>
  );
}
