'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SupplierVerificationPanel } from '@/components/supplier-verification-panel';

type Plan = { id: string; code: string; name: string; description: string; listing_limit: number; display_price: string; features: string[] };
type Payment = { id: string; amount: number; currency: string; payment_method: string; transaction_reference: string; status: string; supplier_note?: string | null; verified_at?: string | null; created_at: string };
type Membership = { id: string; status: string; quoted_amount: number | null; currency: string; billing_interval: string; quote_expires_at: string | null; period_start: string | null; period_end: string | null; created_at: string; plan: Plan | Plan[]; payments: Payment[] };
type Listing = { id: string; title: string; slug: string; listing_type: string; category: string; description: string; state: string; city: string | null; price_type: string; price: number | null; currency: string; keywords: string[]; status: string; created_at: string; updated_at: string };
type Offer = { id: string; anonymised_summary: string; quoted_fee: number; currency: string; payment_status: string; supplier_accepted_at: string | null; supplier_declined_at: string | null; supplier_response_note: string | null; payment_verified_at: string | null; customer_approved_at: string | null; customer_declined_at: string | null; contact_released_at: string | null; created_at: string; customer: { category: string; state: string; city: string | null; contact_released: boolean; name: string | null; email: string | null; phone: string | null; preferred_contact: string | null; request_details: string | null } };
type DashboardData = { supplier: { business_name: string; contact_name: string; email: string; phone: string; category: string; state: string }; listings: Listing[]; memberships: Membership[]; offers: Offer[]; plans: Plan[]; paymentInstructions: string };

function planOf(membership: Membership) { return Array.isArray(membership.plan) ? membership.plan[0] : membership.plan; }
function dateText(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'; }
function money(value: number | null, currency = 'NGN') { if (value === null) return 'Awaiting quotation'; try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); } catch { return `${currency} ${value}`; } }

export function SupplierDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentSubscriptionId, setPaymentSubscriptionId] = useState('');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/supplier/dashboard', { cache: 'no-store' });
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Supplier data could not be loaded.');
      setData(result as DashboardData);
      const pending = (result.memberships as Membership[]).find((m) => m.status === 'awaiting_payment');
      setPaymentSubscriptionId(pending?.id || '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Supplier data could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function requestPlan(code: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/supplier/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode: code, billingInterval: 'monthly' }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Plan request failed.');
      setNotice(result.message || 'Membership request saved.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Plan request failed.'); }
    finally { setBusy(false); }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/supplier/membership/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: paymentSubscriptionId, transactionReference: form.get('transactionReference'), paymentMethod: form.get('paymentMethod'), note: form.get('note') }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Payment reference could not be submitted.');
      formElement.reset(); setNotice(result.message || 'Payment reference submitted.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Payment reference could not be submitted.'); }
    finally { setBusy(false); }
  }

  async function submitListing(event: React.FormEvent<HTMLFormElement>, listingId?: string) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = listingId
        ? await fetch(`/api/supplier/listings/${listingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ...payload }) })
        : await fetch('/api/supplier/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || (listingId ? 'Listing changes could not be saved.' : 'Listing could not be submitted.'));
      formElement.reset();
      if (listingId) setEditingListing(null);
      setNotice(result.message || (listingId ? 'Listing changes submitted for review.' : 'Listing submitted for review.'));
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Listing could not be submitted.'); }
    finally { setBusy(false); }
  }

  async function changeListingStatus(listingId: string, action: 'pause' | 'reactivate') {
    const prompt = action === 'pause'
      ? 'Pause this approved listing? It will disappear from public marketplace results.'
      : 'Submit this paused listing for review again? It will remain hidden until RNX approves it.';
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/listings/${listingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Listing status could not be changed.');
      setNotice(result.message || 'Listing status updated.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Listing status could not be changed.'); }
    finally { setBusy(false); }
  }

  async function respondToOffer(offerId: string, action: 'accept' | 'decline') {
    if (action === 'decline' && !window.confirm('Decline this anonymised opportunity? This response will be recorded and the customer will not be introduced through this offer.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/offers/${offerId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Opportunity response could not be saved.');
      setNotice(result.message || 'Opportunity response recorded.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Opportunity response could not be saved.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/supplier/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/supplier/login');
  }

  const currentMembership = useMemo(() => {
    if (!data) return null;
    return data.memberships.find((m) => m.status === 'awaiting_payment' || m.status === 'requested')
      || data.memberships.find((m) => m.status === 'active') || data.memberships[0] || null;
  }, [data]);
  const activePlan = useMemo(() => data?.memberships.find((m) => m.status === 'active') || null, [data]);
  const plan = currentMembership ? planOf(currentMembership) : activePlan ? planOf(activePlan) : null;

  if (loading && !data) return <div className="empty-state">Loading supplier portal…</div>;
  if (!data) return <div className="form-card"><p className="form-error">{error || 'Supplier dashboard unavailable.'}</p><button className="button" type="button" onClick={() => void refresh()}>Try again</button></div>;

  return <section className="supplier-dashboard">
    <div className="supplier-dashboard-toolbar"><div><span className="admin-private-tag">PRIVATE SUPPLIER AREA</span><h2>{data.supplier.business_name}</h2><p>{data.supplier.category} · {data.supplier.state} · Account approved</p></div><div className="supplier-toolbar-actions"><button className="button button-small button-dark" type="button" disabled={loading} onClick={() => void refresh()}>Refresh</button><button className="button button-small" type="button" onClick={() => void logout()}>Sign out</button></div></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="supplier-stat-grid">
      <article><span>Catalogue submissions</span><strong>{data.listings.length}</strong></article>
      <article><span>Approved listings</span><strong>{data.listings.filter((x) => x.status === 'approved').length}</strong></article>
      <article><span>Opportunity offers</span><strong>{data.offers.length}</strong></article>
      <article><span>Current membership</span><strong>{plan?.name || 'Starter'}</strong></article>
    </div>

    <SupplierVerificationPanel />

    <section className="supplier-panel">
      <div className="supplier-section-heading"><div><p className="eyebrow">ACCOUNT AND BILLING</p><h2>Membership</h2></div><span className={`admin-state-${currentMembership?.status === 'active' ? 'good' : 'wait'}`}>{currentMembership?.status || 'No active plan'}</span></div>
      {currentMembership && <div className="membership-current-card"><div><strong>{plan?.name || 'Supplier plan'}</strong><p>{plan?.description}</p><small>{plan?.listing_limit ?? '—'} catalogue listings · {currentMembership.billing_interval} billing</small></div><strong>{money(currentMembership.quoted_amount, currentMembership.currency)}</strong></div>}
      {currentMembership?.status === 'awaiting_payment' && currentMembership.quoted_amount !== null && <div className="membership-payment-box">
        <div><h3>Quotation and payment</h3><p>Quotation expires {dateText(currentMembership.quote_expires_at)}. Your membership remains inactive until RNX verifies the funds received.</p><div className="payment-instructions">{data.paymentInstructions}</div></div>
        <form className="supplier-payment-form" onSubmit={(event) => void submitPayment(event)}>
          <label>Transaction reference<input name="transactionReference" required minLength={3} maxLength={120} /></label>
          <label>Payment method<select name="paymentMethod"><option value="bank_transfer">Bank transfer</option><option value="other">Other verified payment channel</option></select></label>
          <label>Note (optional)<input name="note" maxLength={500} /></label>
          <button className="button" type="submit" disabled={busy || !paymentSubscriptionId}>{busy ? 'Submitting…' : 'Submit payment reference'}</button>
        </form>
      </div>}
      {currentMembership?.status === 'requested' && <p className="form-status">Your plan request is with RNX operations. A quotation and payment instructions will be issued before payment is requested.</p>}
      <div className="membership-plan-grid">
        {data.plans.map((item) => <article className={`membership-plan-card ${item.code === plan?.code ? 'is-current' : ''}`} key={item.id}>
          <span className="eyebrow">{item.code === 'starter' ? 'ENTRY PLAN' : item.code === 'growth' ? 'GROWING SUPPLIERS' : 'LARGE OPERATIONS'}</span>
          <h3>{item.name}</h3><p>{item.description}</p><strong>{item.display_price}</strong>
          <ul>{item.features.map((feature, index) => <li key={index}>{feature}</li>)}</ul>
          {item.code !== plan?.code && <button className="button button-small" type="button" disabled={busy || Boolean(data.memberships.some((m) => ['requested','awaiting_payment'].includes(m.status)))} onClick={() => void requestPlan(item.code)}>{item.code === 'starter' ? 'Switch to Starter' : 'Request this plan'}</button>}
        </article>)}
      </div>
      <p className="admin-footnote">A membership does not guarantee a lead, sale, ranking position or business outcome. Any commercial price is quoted by RNX and must be agreed before payment.</p>
      {currentMembership?.payments?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Payment reference</th><th>Amount</th><th>Method</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{currentMembership.payments.map((payment) => <tr key={payment.id}><td>{payment.transaction_reference}</td><td>{money(payment.amount, payment.currency)}</td><td>{payment.payment_method}</td><td>{payment.status}</td><td>{dateText(payment.created_at)}</td></tr>)}</tbody></table></div> : null}
    </section>

    <section className="supplier-panel">
      <div className="supplier-section-heading"><div><p className="eyebrow">SUPPLIER CATALOGUE</p><h2>Your products and services</h2><p>New or edited offers remain private until reviewed and approved.</p></div><span>{data.listings.length} total</span></div>
      {editingListing && <div className="supplier-editing-banner"><div><strong>Editing: {editingListing.title}</strong><p>Saving changes sends this offer back to RNX review. It stays hidden from the public marketplace until it is approved.</p></div><button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => setEditingListing(null)}>Cancel edit</button></div>}
      {editingListing && <form key={editingListing.id} className="supplier-listing-form" onSubmit={(event) => void submitListing(event, editingListing.id)}>
        <label>Offer title<input name="title" required minLength={3} maxLength={180} defaultValue={editingListing.title} /></label>
        <label>Listing type<select name="listing_type" defaultValue={editingListing.listing_type}><option value="product">Product</option><option value="service">Service</option><option value="wholesale">Wholesale supply</option><option value="rental">Rental</option></select></label>
        <label>Category<input name="category" defaultValue={editingListing.category} required minLength={2} maxLength={120} /></label>
        <label>State<input name="state" defaultValue={editingListing.state} required minLength={2} maxLength={60} /></label>
        <label>City (optional)<input name="city" maxLength={100} defaultValue={editingListing.city || ''} /></label>
        <label>Price display<select name="price_type" defaultValue={editingListing.price_type}><option value="enquiry">Request quotation</option><option value="fixed">Fixed price</option><option value="from">Price from</option></select></label>
        <label>Price in NGN (for fixed/from)<input name="price" inputMode="decimal" defaultValue={editingListing.price ?? ''} /></label>
        <label className="full-field">Search keywords, separated by commas<input name="keywords" maxLength={500} defaultValue={(editingListing.keywords || []).join(', ')} /></label>
        <label className="full-field">Description<textarea name="description" rows={4} required minLength={30} maxLength={3000} defaultValue={editingListing.description} /></label>
        <div className="full-field"><button className="button" type="submit" disabled={busy}>{busy ? 'Saving changes…' : 'Save changes & submit for review'}</button></div>
      </form>}
      <form key="new-listing-form" className="supplier-listing-form" onSubmit={(event) => void submitListing(event)}>
        <label>Offer title<input name="title" required minLength={3} maxLength={180} placeholder="Product or service name" /></label>
        <label>Listing type<select name="listing_type"><option value="product">Product</option><option value="service">Service</option><option value="wholesale">Wholesale supply</option><option value="rental">Rental</option></select></label>
        <label>Category<input name="category" defaultValue={data.supplier.category} required minLength={2} maxLength={120} /></label>
        <label>State<input name="state" defaultValue={data.supplier.state} required minLength={2} maxLength={60} /></label>
        <label>City (optional)<input name="city" maxLength={100} /></label>
        <label>Price display<select name="price_type"><option value="enquiry">Request quotation</option><option value="fixed">Fixed price</option><option value="from">Price from</option></select></label>
        <label>Price in NGN (for fixed/from)<input name="price" inputMode="decimal" /></label>
        <label className="full-field">Search keywords, separated by commas<input name="keywords" maxLength={500} placeholder="brand, model, capacity, service area" /></label>
        <label className="full-field">Description<textarea name="description" rows={4} required minLength={30} maxLength={3000} placeholder="Specifications, coverage, availability, terms and important limitations." /></label>
        <div className="full-field"><button className="button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit new listing for review'}</button></div>
      </form>
      {data.listings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Offer</th><th>Category / location</th><th>Price</th><th>Status / actions</th><th>Submitted</th></tr></thead><tbody>{data.listings.map((listing) => <tr key={listing.id}><td><strong>{listing.title}</strong><small>{listing.listing_type}</small></td><td>{listing.category}<small>{[listing.city, listing.state].filter(Boolean).join(', ')}</small></td><td>{listing.price_type === 'enquiry' ? 'Enquiry' : money(listing.price, listing.currency)}</td><td><span className={`admin-state-${listing.status === 'approved' ? 'good' : listing.status === 'rejected' ? 'bad' : 'wait'}`}>{listing.status}</span>{listing.status === 'approved' ? <button className="button button-small button-dark" type="button" disabled={busy} onClick={() => void changeListingStatus(listing.id, 'pause')}>Pause to edit</button> : <button className="button button-small" type="button" disabled={busy} onClick={() => setEditingListing(listing)}>{listing.status === 'rejected' ? 'Correct & resubmit' : 'Edit offer'}</button>}{listing.status === 'paused' && <button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => void changeListingStatus(listing.id, 'reactivate')}>Submit unchanged</button>}</td><td>{dateText(listing.created_at)}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No catalogue listings submitted yet.</div>}
    </section>

    <section className="supplier-panel">
      <div className="supplier-section-heading"><div><p className="eyebrow">OPPORTUNITY INBOX</p><h2>Customer opportunities</h2><p>Only anonymised summaries are shown until the RNX contact-release process has completed.</p></div><span>{data.offers.length} offers</span></div>
      {data.offers.length ? <div className="supplier-opportunity-list">{data.offers.map((offer) => <article className="supplier-opportunity" key={offer.id}>
        <div className="supplier-opportunity-top"><span className={`admin-state-${offer.supplier_declined_at ? 'bad' : offer.payment_status === 'paid' ? 'good' : 'wait'}`}>{offer.supplier_declined_at ? 'supplier declined' : offer.payment_status}</span><small>{dateText(offer.created_at)}</small></div>
        <h3>{offer.customer.category} · {[offer.customer.city, offer.customer.state].filter(Boolean).join(', ')}</h3>
        <p>{offer.anonymised_summary}</p>
        <div className="supplier-opportunity-meta"><span>Proposed fee: {money(offer.quoted_fee, offer.currency)}</span><span>Supplier response: {offer.supplier_accepted_at ? 'Accepted' : offer.supplier_declined_at ? 'Declined' : 'Awaiting your decision'}</span><span>Customer consent: {offer.customer_approved_at ? 'Approved' : offer.customer_declined_at ? 'Declined' : 'Pending'}</span></div>
        {!offer.supplier_accepted_at && !offer.supplier_declined_at && !offer.customer_declined_at && <div className="supplier-offer-actions"><button className="button button-small" type="button" disabled={busy} onClick={() => void respondToOffer(offer.id, 'accept')}>Accept fee and opportunity</button><button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => void respondToOffer(offer.id, 'decline')}>Decline opportunity</button></div>}
        {offer.supplier_declined_at && <p className="form-status">You declined this offer on {dateText(offer.supplier_declined_at)}. It cannot be re-opened from the supplier portal.</p>}
        {offer.customer.contact_released && <div className="supplier-contact-release"><strong>Customer introduction authorised and recorded</strong><p>{offer.customer.name || 'Customer'} · {offer.customer.phone || 'No phone'} · {offer.customer.email || 'No email'}</p><small>Preferred channel: {offer.customer.preferred_contact || 'Not stated'}</small></div>}
        {!offer.customer.contact_released && <small className="admin-footnote">Customer identity and direct contact details are locked. Payment and explicit customer approval are required before release.</small>}
      </article>)}</div> : <div className="admin-empty">No opportunity offers have been assigned to this supplier.</div>}
    </section>
  </section>;
}
