import Link from 'next/link';

export const metadata = {
  title: 'How RuffNeck Exchange Works',
  description: 'Understand customer requests, supplier review, opportunity matching, payment checks and customer-authorised introductions.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return <main className="page-shell container narrow-shell">
    <div className="page-intro">
      <p className="eyebrow">THE RNX PROCESS</p>
      <h1>A marketplace with an accountable introduction process.</h1>
      <p>RuffNeck Exchange helps customers describe what they need and helps suitable businesses assess real opportunities. It is an intermediary, not simply a directory.</p>
    </div>
    <div className="content-stack">
      <section><span className="step-number">01</span><h2>Customers describe what they need</h2><p>Customers can browse categories or submit a free product, service, wholesale, procurement or partnership request. A useful brief includes specifications, quantity, location, timing and any essential requirements.</p></section>
      <section><span className="step-number">02</span><h2>RNX reviews and qualifies the brief</h2><p>The operations team checks whether the request is understandable, contactable and suitable for supplier matching. Matching recommendations help staff identify relevant approved businesses; staff review the match before an offer is created.</p></section>
      <section><span className="step-number">03</span><h2>The supplier receives an anonymised opportunity</h2><p>Where a suitable supplier is available, RNX prepares an opportunity summary without the customer's name, phone number, email address or other direct identifiers. The supplier can accept or decline the opportunity and its stated commercial terms.</p></section>
      <section><span className="step-number">04</span><h2>Payment and consent are checked separately</h2><p>For a fee-based introduction, the supplier's payment is independently checked against the exact agreed amount, currency and transaction reference. RNX does not treat a screenshot or supplier-submitted claim as proof of payment. The customer separately approves or declines the specific introduction.</p></section>
      <section><span className="step-number">05</span><h2>Only an authorised introduction is released</h2><p>Customer contact details are released only after supplier acceptance, payment verification and the customer's explicit permission. Staff record the release after it has actually happened. A qualified enquiry alone does not authorise disclosure.</p></section>
      <section><span className="step-number">06</span><h2>Outcomes and disputes are tracked</h2><p>RNX records introduction outcomes and provides a private route for customers to raise complaints or disputes. A case review does not automatically establish liability or guarantee a refund, replacement or commercial result.</p></section>
    </div>
    <div className="notice"><strong>Payment boundary:</strong> Customers can submit sourcing requests without paying RNX. Supplier memberships, advertising and introduction fees are separate RNX services. Purchases of third-party goods and services are arranged and paid for directly with the relevant supplier. RNX currently uses manual payment verification; automated payment-gateway checkout is not active.</div>
    <div className="hero-links"><Link className="button" href="/request">Submit a free request</Link><Link className="text-link" href="/business/register">Register as a supplier ↗</Link></div>
  </main>;
}
