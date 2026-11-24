'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type QuoteEvent = {
  id: string;
  actor_role: 'supplier' | 'customer' | 'system';
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

type CommercialQuote = {
  id: string;
  quote_reference: string;
  lead_offer_id: string;
  lead_id: string;
  supplier_application_id: string;
  title: string;
  scope_description: string;
  total_amount: number;
  currency: string;
  delivery_terms: string;
  estimated_fulfilment: string | null;
  valid_until: string;
  status: 'submitted' | 'selected' | 'not_selected' | 'declined' | 'withdrawn' | 'expired';
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  supplier: { business_name: string; public_slug: string | null } | null;
  request: { category: string; state: string; city: string | null } | null;
  events: QuoteEvent[];
};

type QuoteReport = {
  quotes: CommercialQuote[];
  summary: { total: number; awaitingCustomer: number; preferred: number; declined: number; expired: number; withdrawn: number; notSelected: number };
  capped: boolean;
};

const STATUS_LABELS: Record<CommercialQuote['status'], string> = {
  submitted: 'Awaiting customer',
  selected: 'Customer preferred',
  not_selected: 'Not selected',
  declined: 'Declined',
  withdrawn: 'Supplier withdrew',
  expired: 'Expired',
};

function stamp(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function money(value: number, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
  }
}

function eventLabel(event: QuoteEvent) {
  const actor = event.actor_role === 'system' ? 'RNX system' : event.actor_role === 'customer' ? 'Customer' : 'Supplier';
  const action: Record<string, string> = {
    submitted: 'submitted the quotation',
    selected: 'marked the quotation as preferred',
    not_selected: 'marked the quotation as not selected',
    declined: 'declined the quotation',
    withdrawn: 'withdrew the quotation',
    expired: 'marked the quotation as expired',
  };
  return `${actor} ${action[event.event_type] || event.event_type.replaceAll('_', ' ')}.`;
}

function csvCell(value: string | number | null | undefined) {
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function AdminCommercialQuoteConsole() {
  const [report, setReport] = useState<QuoteReport | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/quotes', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      if (response.status === 403) {
        window.location.assign('/admin/forbidden');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Commercial quotations could not be loaded.');
      setReport(result as QuoteReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Commercial quotations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (report?.quotes ?? []).filter((quote) => {
      const matchesStatus = filter === 'all' || quote.status === filter;
      const haystack = [quote.quote_reference, quote.title, quote.supplier?.business_name, quote.request?.category, quote.request?.city, quote.request?.state, quote.lead_id].filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [report, filter, search]);

  function exportCsv() {
    const rows = [
      ['Quote reference', 'Status', 'Supplier', 'Category', 'Location', 'Title', 'Amount', 'Currency', 'Created', 'Valid until', 'Responded', 'Request ID'],
      ...visible.map((quote) => [quote.quote_reference, STATUS_LABELS[quote.status], quote.supplier?.business_name || '', quote.request?.category || '', [quote.request?.city, quote.request?.state].filter(Boolean).join(', '), quote.title, Number(quote.total_amount), quote.currency, quote.created_at, quote.valid_until, quote.responded_at || '', quote.lead_id]),
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => csvCell(cell as string | number)).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rnx-commercial-quotations.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const summary = report?.summary;
  const stats: Array<[string, number]> = summary ? [
    ['Latest records', summary.total],
    ['Awaiting customer', summary.awaitingCustomer],
    ['Customer preferred', summary.preferred],
    ['Declined', summary.declined],
    ['Expired', summary.expired],
    ['Withdrawn', summary.withdrawn],
  ] : [];

  return <section className="admin-commercial-quotes supplier-panel">
    <div className="supplier-section-heading">
      <div><p className="eyebrow">QUOTE PIPELINE MONITORING</p><h2>Supplier commercial proposals</h2><p>Read-only oversight of quotations recorded in RNX. Amounts are supplier proposals, not RNX revenue or verified transaction values.</p></div>
      <div className="admin-commercial-actions"><button className="button button-small" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button><button className="button button-small button-dark" type="button" onClick={exportCsv} disabled={!visible.length}>Export visible CSV</button></div>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !report && <div className="admin-empty">Loading commercial quotations…</div>}
    {report && <>
      <div className="admin-commercial-stats">{stats.map(([label, value]) => <article key={label}><span>{label}</span><strong>{new Intl.NumberFormat('en-NG').format(value)}</strong></article>)}</div>
      <div className="admin-commercial-toolbar">
        <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Quote reference, supplier, title or location" /></label>
        <label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="submitted">Awaiting customer</option><option value="selected">Customer preferred</option><option value="not_selected">Not selected</option><option value="declined">Declined</option><option value="withdrawn">Supplier withdrew</option><option value="expired">Expired</option></select></label>
      </div>
      {report.capped && <p className="admin-commercial-cap">Showing the latest 250 quotations. Older records are not included in these counts or this export.</p>}
      <p className="admin-commercial-result-count">{visible.length} quotation{visible.length === 1 ? '' : 's'} match the current view.</p>
      {visible.length === 0 ? <div className="admin-empty">No commercial quotations match this filter.</div> : <div className="admin-commercial-list">{visible.map((quote) => {
        const expiredButOpen = quote.status === 'submitted' && new Date(quote.valid_until).getTime() <= Date.now();
        return <article className="admin-commercial-card" key={quote.id}>
          <div className="admin-commercial-card-top"><div><p className="eyebrow">{quote.quote_reference}</p><h3>{quote.title}</h3><p>{quote.supplier?.business_name || 'Supplier record unavailable'} · {[quote.request?.category, quote.request?.city, quote.request?.state].filter(Boolean).join(' · ') || 'Request location unavailable'}</p></div><span className={`admin-commercial-status status-${quote.status}`}>{expiredButOpen ? 'Past validity · awaiting expiry processing' : STATUS_LABELS[quote.status]}</span></div>
          <div className="admin-commercial-amount">{money(quote.total_amount, quote.currency)}</div>
          <div className="admin-commercial-grid">
            <div><span>Scope / specification</span><p>{quote.scope_description}</p></div>
            <div><span>Delivery and payment terms</span><p>{quote.delivery_terms}</p></div>
            <div><span>Estimated fulfilment</span><p>{quote.estimated_fulfilment || 'Not specified'}</p></div>
            <div><span>Validity</span><p>Until {stamp(quote.valid_until)}</p></div>
          </div>
          <div className="admin-commercial-meta"><span>Submitted {stamp(quote.created_at)}</span><span>Last updated {stamp(quote.updated_at)}</span><span>Responded {stamp(quote.responded_at)}</span><span>Request {quote.lead_id}</span></div>
          <details className="admin-commercial-events"><summary>Recorded history ({quote.events.length})</summary>{quote.events.length ? <ol>{quote.events.map((event) => <li key={event.id}><div><strong>{eventLabel(event)}</strong><time>{stamp(event.created_at)}</time></div>{event.event_type === 'submitted' && event.details && <small>Submitted amount: {String(event.details.currency || quote.currency)} {String(event.details.total_amount ?? quote.total_amount)}</small>}</li>)}</ol> : <p>No event history is available for this quotation.</p>}</details>
        </article>;
      })}</div>}
      <p className="admin-commercial-note">Operational note: a customer marking a quote as preferred is not a payment, purchase order, binding contract, proof of delivery or evidence of completed fulfilment. Supplier and customer remain responsible for their commercial agreement.</p>
    </>}
  </section>;
}
