type QuoteRevisionRecord = {
  id: string;
  quote_reference: string;
  title: string;
  scope_description: string;
  total_amount: number;
  currency: string;
  delivery_terms: string;
  estimated_fulfilment: string | null;
  valid_until: string;
  status: string;
  created_at: string;
  revision_of_quote_id?: string | null;
  revision_request_note?: string | null;
  revision_requested_at?: string | null;
};

type Props = {
  quotes: QuoteRevisionRecord[];
  audience: 'customer' | 'supplier';
};

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Not recorded'
    : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function amountLabel(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString('en-NG')}`;
  }
}

function changed(previous: string | null | undefined, current: string | null | undefined) {
  return (previous ?? '').trim() !== (current ?? '').trim();
}

function changeLabel(previous: QuoteRevisionRecord, current: QuoteRevisionRecord) {
  const labels: string[] = [];
  if (changed(previous.title, current.title)) labels.push('Title');
  if (previous.total_amount !== current.total_amount || previous.currency !== current.currency) labels.push('Price');
  if (changed(previous.scope_description, current.scope_description)) labels.push('Scope');
  if (changed(previous.delivery_terms, current.delivery_terms)) labels.push('Delivery terms');
  if (changed(previous.estimated_fulfilment, current.estimated_fulfilment)) labels.push('Estimated fulfilment');
  if (previous.valid_until !== current.valid_until) labels.push('Validity');
  return labels;
}

function priceChange(previous: QuoteRevisionRecord, current: QuoteRevisionRecord) {
  if (previous.currency !== current.currency) {
    return `Currency changed from ${previous.currency} to ${current.currency}; the amounts are not directly comparable.`;
  }
  const difference = Number(current.total_amount) - Number(previous.total_amount);
  if (!Number.isFinite(difference) || difference === 0) return 'No price change.';
  const direction = difference > 0 ? 'increased' : 'decreased';
  const amount = amountLabel(Math.abs(difference), current.currency);
  const percentage = Number(previous.total_amount) > 0
    ? ` (${(Math.abs(difference) / Number(previous.total_amount) * 100).toFixed(1)}%)`
    : '';
  return `Price ${direction} by ${amount}${percentage}.`;
}

function textDiff(label: string, previous: string | null | undefined, current: string | null | undefined) {
  if (!changed(previous, current)) return null;
  return (
    <details className="rnx-quote-revision-diff-field">
      <summary>{label} changed · view before and after</summary>
      <div className="rnx-quote-revision-diff-values">
        <div><small>Previous version</small><p>{previous?.trim() || 'Not stated'}</p></div>
        <div><small>Revised version</small><p>{current?.trim() || 'Not stated'}</p></div>
      </div>
    </details>
  );
}

function QuoteChain({ chain, audience }: { chain: QuoteRevisionRecord[]; audience: Props['audience'] }) {
  const first = chain[0];
  return (
    <details className="rnx-quote-revision-history-chain">
      <summary>
        <span><strong>{first.quote_reference}</strong> · {chain.length} {chain.length === 1 ? 'version' : 'linked versions'}</span>
        <small>Open revision timeline</small>
      </summary>
      <ol className="rnx-quote-revision-history-list">
        {chain.map((quote, versionIndex) => {
          const previous = versionIndex > 0 ? chain[versionIndex - 1] : null;
          const fields = previous ? changeLabel(previous, quote) : [];
          return (
            <li key={quote.id} className="rnx-quote-revision-history-item">
              <div className="rnx-quote-revision-history-marker" aria-hidden="true">{versionIndex + 1}</div>
              <article>
                <div className="rnx-quote-revision-history-heading">
                  <div><strong>Version {versionIndex + 1} · {quote.quote_reference}</strong><small>{dateLabel(quote.created_at)}</small></div>
                  <span className={`admin-state-${quote.status === 'selected' ? 'good' : quote.status === 'submitted' || quote.status === 'revision_requested' ? 'wait' : quote.status === 'declined' || quote.status === 'withdrawn' || quote.status === 'not_selected' ? 'bad' : 'wait'}`}>{quote.status.replaceAll('_', ' ')}</span>
                </div>
                <h5>{quote.title}</h5>
                <p className="rnx-quote-revision-history-price">{amountLabel(quote.total_amount, quote.currency)}</p>
                <p className="rnx-quote-revision-history-meta">Valid until {dateLabel(quote.valid_until)}</p>
                {previous && <section className="rnx-quote-revision-diff" aria-label={`Changes from ${previous.quote_reference} to ${quote.quote_reference}`}>
                  <strong>Changes from the previous version</strong>
                  <p>{fields.length ? fields.join(' · ') : 'No differences detected in the recorded quotation fields.'}</p>
                  {(previous.total_amount !== quote.total_amount || previous.currency !== quote.currency) && <p className="rnx-quote-revision-price-delta">{priceChange(previous, quote)}</p>}
                  {textDiff('Scope / specification', previous.scope_description, quote.scope_description)}
                  {textDiff('Delivery terms', previous.delivery_terms, quote.delivery_terms)}
                  {textDiff('Estimated fulfilment', previous.estimated_fulfilment, quote.estimated_fulfilment)}
                  {textDiff('Quotation title', previous.title, quote.title)}
                  {previous.valid_until !== quote.valid_until && <p className="rnx-quote-revision-validity-delta">Validity changed from {dateLabel(previous.valid_until)} to {dateLabel(quote.valid_until)}.</p>}
                  {previous.currency !== quote.currency && <p className="rnx-quote-revision-currency-warning">The currency changed. RNX does not convert the amounts or rank them by value.</p>}
                  {chain[versionIndex - 1]?.revision_request_note && <blockquote><strong>Customer's revision request</strong><p>{chain[versionIndex - 1].revision_request_note}</p></blockquote>}
                </section>}
                {!previous && <p className="rnx-quote-revision-origin">Original quotation in this revision chain.</p>}
                {quote.status === 'revision_requested' && quote.revision_request_note && <blockquote className="rnx-quote-revision-history-request"><strong>{audience === 'supplier' ? 'Customer requested these changes' : 'Your revision request'}</strong><p>{quote.revision_request_note}</p><small>Requested {dateLabel(quote.revision_requested_at)}</small></blockquote>}
              </article>
            </li>
          );
        })}
      </ol>
      <p className="rnx-quote-revision-history-disclaimer">This timeline compares the quotation records stored in RNX. It does not determine whether the parties agreed to a contract, made payment or completed fulfilment.</p>
    </details>
  );
}

export function CommercialQuoteRevisionHistory({ quotes, audience }: Props) {
  if (!quotes.some((quote) => quote.revision_of_quote_id)) return null;

  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  const childMap = new Map<string, QuoteRevisionRecord[]>();
  for (const quote of quotes) {
    if (!quote.revision_of_quote_id) continue;
    const children = childMap.get(quote.revision_of_quote_id) || [];
    children.push(quote);
    childMap.set(quote.revision_of_quote_id, children);
  }
  for (const children of childMap.values()) children.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const roots = quotes.filter((quote) => !quote.revision_of_quote_id || !byId.has(quote.revision_of_quote_id));
  const visited = new Set<string>();
  const chains: QuoteRevisionRecord[][] = [];
  const appendChain = (root: QuoteRevisionRecord) => {
    const chain: QuoteRevisionRecord[] = [];
    let current: QuoteRevisionRecord | undefined = root;
    while (current && !visited.has(current.id)) {
      chain.push(current);
      visited.add(current.id);
      current = (childMap.get(current.id) || []).find((child) => !visited.has(child.id));
    }
    if (chain.length > 1) chains.push(chain);
  };
  roots.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(appendChain);
  // Preserve visibility if historical data contains an orphan or malformed cycle.
  quotes.filter((quote) => !visited.has(quote.id)).sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(appendChain);
  if (!chains.length) return null;

  return (
    <section className="rnx-quote-revision-history" aria-label="Commercial quotation revision history">
      <div className="rnx-quote-revision-history-intro">
        <div><p className="eyebrow">VERSION CONTROL</p><h5>Quotation revision history</h5><p>Review earlier proposals, customer change requests and the differences in each revised version.</p></div>
        <span>{chains.reduce((total, chain) => total + chain.length, 0)} versions</span>
      </div>
      <div className="rnx-quote-revision-history-chains">
        {chains.map((chain) => <QuoteChain key={chain[0].id} chain={chain} audience={audience} />)}
      </div>
    </section>
  );
}
