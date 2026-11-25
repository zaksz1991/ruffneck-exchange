import Link from 'next/link';
import { PrintQuoteDocumentButton } from '@/components/print-quote-document-button';
import type { CommercialQuoteDocumentData, CommercialQuoteDocumentAudience } from '@/lib/commercial-quote-document';

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString('en-NG', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function CommercialQuoteDocument({
  data,
  audience,
}: {
  data: CommercialQuoteDocumentData;
  audience: CommercialQuoteDocumentAudience;
}) {
  const { quote, customer, supplier, request } = data;
  const dashboardPath = audience === 'customer' ? '/customer/dashboard' : '/supplier/dashboard';
  const requestLocation = [request.city, request.state].filter(Boolean).join(', ');

  return (
    <main className="page-shell container rnx-quote-document-page">
      <div className="rnx-quote-document-toolbar" aria-label="Quotation document actions">
        <Link className="button button-small button-secondary" href={dashboardPath}>Back to dashboard</Link>
        <div>
          <span>Use your browser's print dialog and choose “Save as PDF” for a PDF copy.</span>
          <PrintQuoteDocumentButton />
        </div>
      </div>

      <article className="rnx-quote-document-sheet">
        <header className="rnx-quote-document-brand">
          <div>
            <p className="rnx-quote-document-brand-name">RUFFNECK <span>EXCHANGE</span></p>
            <p>Products. Services. Businesses. Opportunities.</p>
          </div>
          <span className="rnx-quote-document-label">COMMERCIAL QUOTATION</span>
        </header>

        <section className="rnx-quote-document-title-row">
          <div>
            <p className="eyebrow">SUPPLIER PROPOSAL</p>
            <h1>{quote.title}</h1>
            <p className="rnx-quote-document-reference">Quotation reference <strong>{quote.quote_reference}</strong></p>
          </div>
          <div className={`rnx-quote-document-status status-${quote.status}`}>
            <span>Status</span>
            <strong>{label(quote.status)}</strong>
          </div>
        </section>

        <section className="rnx-quote-document-parties" aria-label="Quotation parties">
          <div>
            <span>Prepared by supplier</span>
            <strong>{supplier.business_name}</strong>
            <small>{supplier.category} · {supplier.state}</small>
          </div>
          <div>
            <span>Prepared for customer</span>
            <strong>{customer.name}</strong>
            <small>RuffNeck Exchange customer</small>
          </div>
        </section>

        <section className="rnx-quote-document-meta" aria-label="Quotation dates and request">
          <div><span>Issued</span><strong>{formatDate(quote.created_at)}</strong></div>
          <div><span>Valid until</span><strong>{formatDate(quote.valid_until)}</strong></div>
          <div><span>Related request</span><strong>{request.category || 'General request'}</strong></div>
          <div><span>Request location</span><strong>{requestLocation || 'Not stated'}</strong></div>
        </section>

        <section className="rnx-quote-document-price">
          <span>Total proposed amount</span>
          <strong>{formatAmount(quote.total_amount, quote.currency)}</strong>
          <small>Currency: {quote.currency}</small>
        </section>

        <section className="rnx-quote-document-section">
          <h2>Scope and specifications</h2>
          <p>{quote.scope_description}</p>
        </section>

        <section className="rnx-quote-document-section">
          <h2>Delivery, payment and other terms</h2>
          <p>{quote.delivery_terms}</p>
        </section>

        <section className="rnx-quote-document-fulfilment">
          <span>Estimated fulfilment</span>
          <strong>{quote.estimated_fulfilment || 'Not stated by supplier'}</strong>
        </section>

        <section className="rnx-quote-document-disclaimer">
          <h2>Important information</h2>
          <p>This document reproduces the supplier's commercial proposal recorded in RuffNeck Exchange. RNX records the proposal and customer preference only. This document is not an invoice, payment receipt, purchase order, contract, proof of fulfilment or guarantee by RNX.</p>
          <p>Before committing funds, both parties should independently confirm the final quantities, specifications, taxes, currency, delivery arrangements, payment schedule and destination, warranties, returns, and any contract terms directly with each other. Confirm the supplier's current quotation status and validity in the RNX account dashboard.</p>
        </section>

        <footer className="rnx-quote-document-footer">
          <span>Generated from the RNX commercial quotation record.</span>
          <span>RuffNeck Exchange · Nigeria</span>
        </footer>
      </article>
    </main>
  );
}
