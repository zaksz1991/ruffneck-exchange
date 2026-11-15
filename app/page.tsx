import Link from 'next/link';
import { departments, site } from '@/lib/site';

const platforms = [
  { name: 'RuffNeck LMS', description: 'Learning, training and course delivery.', href: 'https://ruffneck-lms.vercel.app/' },
  { name: 'RuffNeck Prospector', description: 'Business prospecting and customer acquisition.', href: 'https://ruffneck-prospector.vercel.app/' },
  { name: 'RuffNeck Connect', description: 'Digital communication and business connection.', href: 'https://ruffneck-connect.vercel.app/' },
  { name: 'RuffNeck Social Hub', description: 'Social media management and community engagement.', href: 'https://ruffneck-social-hub.vercel.app/' },
  { name: 'Kano Run', description: 'A driving game set in Kano.', href: 'https://kano-run.vercel.app/' },
  { name: 'Kano Keke', description: 'A local mobility and gaming experience.', href: 'https://kano-keke.vercel.app/' },
];

export default function Home() {
  return (
    <main>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">THE BUSINESS-TO-BUSINESS EXCHANGE</p>
            <h1>Find the right source.<br /><span>Move business forward.</span></h1>
            <p className="hero-lead">Discover products, source services, compare business options and submit procurement requests across Nigeria and beyond.</p>
            <form action="/marketplace" className="hero-search" role="search">
              <label className="sr-only" htmlFor="home-search">What are you looking for?</label>
              <input id="home-search" type="search" name="q" placeholder="What are you looking for? e.g. packaging, logistics, machinery" />
              <label className="sr-only" htmlFor="home-state">Select state</label>
              <select id="home-state" name="state" defaultValue=""><option value="">All locations</option>{site.states.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button className="button" type="submit">Search</button>
            </form>
            <div className="hero-links"><Link href="/request">Post a free buying request</Link><span>·</span><Link href="/business/register">Register your business</Link></div>
          </div>
          <div className="hero-panel" aria-label="RuffNeck Exchange marketplace summary">
            <div className="panel-top"><span className="live-dot" /> MARKETPLACE ACCESS</div>
            <div className="panel-feature"><span className="panel-number">01</span><div><strong>Products</strong><small>Source goods and equipment</small></div></div>
            <div className="panel-feature"><span className="panel-number">02</span><div><strong>Services</strong><small>Find expertise and service partners</small></div></div>
            <div className="panel-feature"><span className="panel-number">03</span><div><strong>Opportunities</strong><small>Submit needs and procurement briefs</small></div></div>
            <div className="panel-foot"><span>BUILT FOR BUSINESS</span><span>RNX / 001</span></div>
          </div>
        </div>
      </section>

      <section className="trust-strip"><div className="container trust-inner"><span>One exchange</span><span>Multiple industries</span><span>Local and cross-border reach</span><span>Customer-first introductions</span></div></section>

      <section className="section container">
        <div className="section-heading"><div><p className="eyebrow">EXPLORE THE EXCHANGE</p><h2>Business needs do not fit into one industry.</h2></div><Link className="text-link" href="/marketplace">View all departments ↗</Link></div>
        <div className="category-grid">
          {departments.map((item, index) => <Link className="category-card" key={item.slug} href={`/marketplace?category=${encodeURIComponent(item.name)}`}><span className="category-index">{String(index + 1).padStart(2, '0')}</span><h3>{item.name}</h3><p>{item.description}</p><span className="card-arrow">Explore category ↗</span></Link>)}
        </div>
      </section>

      <section className="process-band"><div className="container process-layout"><div><p className="eyebrow">HOW IT WORKS</p><h2>One request.<br />A clearer route to market.</h2><p>RNX helps qualify customer requirements and coordinate supplier introductions. It is an intermediary, not simply a directory.</p><Link className="button button-light" href="/how-it-works">Understand the process</Link></div><div className="process-steps"><div><b>01</b><span><strong>Describe the need</strong><small>Submit a product, service or procurement request at no charge.</small></span></div><div><b>02</b><span><strong>We review the brief</strong><small>Requirements and supplier fit are reviewed before an introduction.</small></span></div><div><b>03</b><span><strong>Authorised connection</strong><small>Supplier contact details are only shared after the required permission and terms.</small></span></div></div></div></section>

      <section className="section container seller-section"><div className="section-heading"><div><p className="eyebrow">RUFFNECK ENTERTAINMENT</p><h2>Our products and services have a home here too.</h2><p className="section-intro">Explore RuffNeck platforms and experiences alongside the wider marketplace.</p></div><Link className="text-link" href="/ruffneck">Explore RuffNeck ↗</Link></div><div className="platform-grid">{platforms.map((p, i) => <a className="platform-card" key={p.name} href={p.href} target="_blank" rel="noreferrer"><span className="category-index">RN / 0{i + 1}</span><h3>{p.name}</h3><p>{p.description}</p><span className="card-arrow">Visit platform ↗</span></a>)}</div></section>

      <section className="cta-section"><div className="container cta-inner"><div><p className="eyebrow">START WITH WHAT YOU NEED</p><h2>Have a requirement to source?</h2><p>Send a clear brief. Customer requests are free, and submitting one does not commit you to a purchase.</p></div><Link className="button" href="/request">Submit a request</Link></div></section>
    </main>
  );
}
