'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { SupplierVerificationPanel } from '@/components/supplier-verification-panel';

type Plan = { id: string; code: string; name: string; description: string; listing_limit: number; display_price: string; features: string[] };
type Payment = { id: string; amount: number; currency: string; payment_method: string; transaction_reference: string; status: string; supplier_note?: string | null; verified_at?: string | null; created_at: string };
type Membership = { id: string; status: string; quoted_amount: number | null; currency: string; billing_interval: string; quote_expires_at: string | null; period_start: string | null; period_end: string | null; created_at: string; plan: Plan | Plan[]; payments: Payment[] };
type GalleryImage = { id: string; image_url: string | null; sort_order: number };
type ListingAnalytics = { views_7d: number; views_30d: number; saves_total: number; enquiries_total: number };
type Listing = { id: string; title: string; slug: string; listing_type: string; category: string; description: string; state: string; city: string | null; price_type: string; price: number | null; currency: string; keywords: string[]; status: string; availability_status: 'unconfirmed' | 'available' | 'limited' | 'on_request' | 'out_of_stock'; availability_note: string | null; availability_updated_at: string | null; image_url: string | null; gallery_images: GalleryImage[]; analytics: ListingAnalytics; created_at: string; updated_at: string };
type CommercialQuote = { id: string; lead_offer_id: string; quote_reference: string; title: string; scope_description: string; total_amount: number; currency: string; delivery_terms: string; estimated_fulfilment: string | null; valid_until: string; status: 'submitted' | 'selected' | 'not_selected' | 'declined' | 'withdrawn' | 'expired'; created_at: string; responded_at: string | null };
type Offer = { id: string; anonymised_summary: string; quoted_fee: number; currency: string; payment_status: string; supplier_accepted_at: string | null; supplier_declined_at: string | null; supplier_response_note: string | null; payment_verified_at: string | null; customer_approved_at: string | null; customer_declined_at: string | null; contact_released_at: string | null; created_at: string; outcome: { status: string; customer_outcome: string | null; supplier_outcome: string | null; completed_at: string | null } | null; review: { id: string; rating: number; title: string; body: string; moderation_status: string; supplier_response: string | null } | null; quotes: CommercialQuote[]; customer: { category: string; state: string; city: string | null; contact_released: boolean; name: string | null; email: string | null; phone: string | null; preferred_contact: string | null; request_details: string | null } };
type DashboardData = { supplier: { business_name: string; contact_name: string; email: string; phone: string; category: string; state: string }; listings: Listing[]; listingAnalyticsAvailable: boolean; memberships: Membership[]; offers: Offer[]; plans: Plan[]; paymentInstructions: string };

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
  const [galleryListingId, setGalleryListingId] = useState('');
  const [reviewReplyDrafts, setReviewReplyDrafts] = useState<Record<string, string>>({});

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
    const imageFile = form.get('image');
    form.delete('image');
    const payload = Object.fromEntries(form.entries());
    try {
      const response = listingId
        ? await fetch(`/api/supplier/listings/${listingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ...payload }) })
        : await fetch('/api/supplier/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || (listingId ? 'Listing changes could not be saved.' : 'Listing could not be submitted.'));

      let finalNotice = result.message || (listingId ? 'Listing changes submitted for review.' : 'Listing submitted for review.');
      const targetListingId = listingId || result.listing?.id;
      if (imageFile instanceof File && imageFile.size > 0 && targetListingId) {
        const imageForm = new FormData();
        imageForm.set('image', imageFile);
        const imageResponse = await fetch(`/api/supplier/listings/${targetListingId}/image`, { method: 'POST', body: imageForm });
        const imageResult = await imageResponse.json().catch(() => ({}));
        if (imageResponse.status === 401) { window.location.assign('/supplier/login'); return; }
        if (!imageResponse.ok) {
          finalNotice += ` The listing was saved, but the cover image was not uploaded: ${imageResult.error || 'Upload failed.'} Edit the listing to retry.`;
        } else {
          finalNotice += ' Cover image uploaded successfully.';
        }
      }
      formElement.reset();
      if (listingId) setEditingListing(null);
      setNotice(finalNotice);
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

  async function updateAvailability(event: React.FormEvent<HTMLFormElement>, listing: Listing) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'availability',
          availability_status: form.get('availability_status'),
          availability_note: form.get('availability_note'),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Availability could not be updated.');
      setNotice(result.message || 'Availability updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Availability could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadGalleryImages(event: React.FormEvent<HTMLFormElement>, listing: Listing) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const selected = new FormData(formElement).getAll('images');
    const files = selected.filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!files.length) { setError('Choose at least one additional photo.'); return; }
    if (files.length > 4 || files.some((file) => file.size > 4 * 1024 * 1024)) {
      setError('Choose up to four photos. Each photo must be 4 MB or smaller.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    const payload = new FormData();
    files.forEach((file) => payload.append('images', file));
    try {
      const response = await fetch(`/api/supplier/listings/${listing.id}/gallery`, { method: 'POST', body: payload });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Gallery photos could not be uploaded.');
      formElement.reset();
      setNotice(result.message || 'Gallery photos uploaded.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Gallery photos could not be uploaded.'); }
    finally { setBusy(false); }
  }

  async function removeGalleryImage(listing: Listing, photo: GalleryImage) {
    if (!window.confirm('Remove this additional photo from the listing?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/listings/${listing.id}/gallery`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageId: photo.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Gallery photo could not be removed.');
      setNotice(result.message || 'Gallery photo removed.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Gallery photo could not be removed.'); }
    finally { setBusy(false); }
  }

  async function submitCommercialQuote(event: React.FormEvent<HTMLFormElement>, offerId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      offer_id: offerId,
      title: String(form.get('quote_title') || ''),
      scope_description: String(form.get('scope_description') || ''),
      total_amount: form.get('total_amount'),
      currency: String(form.get('currency') || 'NGN'),
      delivery_terms: String(form.get('delivery_terms') || ''),
      estimated_fulfilment: String(form.get('estimated_fulfilment') || ''),
      valid_days: form.get('valid_days'),
    };
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/supplier/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Commercial quotation could not be submitted.');
      formElement.reset();
      setNotice(result.message || 'Commercial quotation submitted to the customer.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Commercial quotation could not be submitted.'); }
    finally { setBusy(false); }
  }

  async function withdrawCommercialQuote(quoteId: string) {
    if (!window.confirm('Withdraw this quotation? The customer will no longer be able to select it.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/supplier/quotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId, action: 'withdraw' }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Quotation could not be withdrawn.');
      setNotice(result.message || 'Quotation withdrawn.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Quotation could not be withdrawn.'); }
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

  async function confirmOfferOutcome(offerId: string, action: 'confirm_completed' | 'confirm_not_completed') {
    const message = action === 'confirm_completed'
      ? 'Confirm that the customer transaction was completed. The customer must independently confirm the same outcome before RNX treats it as verified.'
      : 'Confirm that the customer transaction was not completed. The customer response will be compared against yours.';
    if (!window.confirm(message)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/offers/${offerId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Transaction outcome could not be recorded.');
      setNotice(result.message || 'Transaction outcome recorded.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Transaction outcome could not be recorded.'); }
    finally { setBusy(false); }
  }

  async function respondToReview(event: React.FormEvent<HTMLFormElement>, reviewId: string) {
    event.preventDefault();
    const responseText = reviewReplyDrafts[reviewId]?.trim() || '';
    if (responseText.length < 2) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/reviews/${reviewId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: responseText }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Review response could not be saved.');
      setReviewReplyDrafts((current) => ({ ...current, [reviewId]: '' }));
      setNotice(result.message || 'Public review response saved.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Review response could not be saved.'); }
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
  const publishedListings = data?.listings.filter((listing) => listing.status === 'approved')
    .sort((left, right) => right.analytics.views_30d - left.analytics.views_30d) ?? [];

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

    <section className="supplier-panel supplier-insights-panel">
      <div className="supplier-section-heading">
        <div><p className="eyebrow">SUPPLIER INSIGHTS</p><h2>Listing performance</h2><p>Understand which published offers are attracting interest.</p></div>
        <span>{publishedListings.length} published</span>
      </div>
      {!data.listingAnalyticsAvailable ? <div className="supplier-insights-unavailable">
        <strong>Performance insights are not active yet.</strong>
        <p>Apply Supabase migration 022 to enable listing performance reports. Your catalogue and supplier portal continue to work without this optional report.</p>
      </div> : publishedListings.length ? <div className="admin-table-wrap supplier-insights-table-wrap">
        <table className="admin-table supplier-insights-table">
          <thead><tr><th>Published offer</th><th>Views · 7 days</th><th>Views · 30 days</th><th>Saves · all time</th><th>Enquiries · all time</th></tr></thead>
          <tbody>{publishedListings.map((listing) => <tr key={listing.id}>
            <td><a href={`/marketplace/listing/${encodeURIComponent(listing.slug)}`} target="_blank" rel="noreferrer">{listing.title}</a><small>{listing.category} · {[listing.city, listing.state].filter(Boolean).join(', ')}</small></td>
            <td>{listing.analytics.views_7d.toLocaleString('en-NG')}</td>
            <td><strong>{listing.analytics.views_30d.toLocaleString('en-NG')}</strong></td>
            <td>{listing.analytics.saves_total.toLocaleString('en-NG')}</td>
            <td>{listing.analytics.enquiries_total.toLocaleString('en-NG')}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="supplier-insights-unavailable"><strong>No published listings to report.</strong><p>Once RNX approves a listing, its performance will appear here.</p></div>}
      <p className="admin-footnote supplier-insights-footnote">View counts include one recorded detail view per listing per browser tab session, and only when the visitor has accepted optional analytics. They are not unique-person counts and exclude visitors who decline analytics. Saves and enquiries are aggregate counts for the listing; customer identities and contact details are never shown in this report.</p>
    </section>

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
        <label className="full-field">Cover image (JPEG, PNG or WebP; maximum 4 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        {editingListing.image_url && <div className="full-field supplier-image-preview"><span>Current cover image</span><img src={editingListing.image_url} alt={editingListing.title} /></div>}
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
        <label className="full-field">Cover image (JPEG, PNG or WebP; maximum 4 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label className="full-field">Description<textarea name="description" rows={4} required minLength={30} maxLength={3000} placeholder="Specifications, coverage, availability, terms and important limitations." /></label>
        <div className="full-field"><button className="button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit new listing for review'}</button></div>
      </form>
      {data.listings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Image</th><th>Offer</th><th>Category / location</th><th>Price</th><th>Status / actions</th><th>Submitted</th></tr></thead><tbody>{data.listings.map((listing) => <Fragment key={listing.id}>
        <tr key={listing.id}>
          <td><div className="supplier-photo-stack">{listing.image_url ? <img className="supplier-listing-thumb" src={listing.image_url} alt={listing.title} /> : <span className="admin-footnote">No cover</span>}<small>{listing.gallery_images?.length || 0}/4 gallery photos</small></div></td>
          <td><strong>{listing.title}</strong><small>{listing.listing_type}</small></td>
          <td>{listing.category}<small>{[listing.city, listing.state].filter(Boolean).join(', ')}</small></td>
          <td>{listing.price_type === 'enquiry' ? 'Enquiry' : money(listing.price, listing.currency)}</td>
          <td>
            <span className={`admin-state-${listing.status === 'approved' ? 'good' : listing.status === 'rejected' ? 'bad' : 'wait'}`}>{listing.status}</span>
            {listing.status === 'approved' ? <button className="button button-small button-dark" type="button" disabled={busy} onClick={() => void changeListingStatus(listing.id, 'pause')}>Pause to edit</button> : <button className="button button-small" type="button" disabled={busy} onClick={() => setEditingListing(listing)}>{listing.status === 'rejected' ? 'Correct & resubmit' : 'Edit offer'}</button>}
            {listing.status === 'paused' && <button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => void changeListingStatus(listing.id, 'reactivate')}>Submit unchanged</button>}
            <button className="button button-small" type="button" disabled={busy || listing.status === 'approved'} title={listing.status === 'approved' ? 'Pause this approved listing before managing gallery photos.' : 'Manage additional listing photos'} onClick={() => setGalleryListingId((current) => current === listing.id ? '' : listing.id)}>{galleryListingId === listing.id ? 'Close photos' : `Manage photos (${listing.gallery_images?.length || 0}/4)`}</button>
            {listing.status === 'approved' && <form key={`${listing.id}-${listing.availability_status}-${listing.availability_note || ''}-${listing.availability_updated_at || ''}`} className="supplier-availability-form" onSubmit={(event) => void updateAvailability(event, listing)}>
              <label>Public availability<select name="availability_status" defaultValue={listing.availability_status || 'unconfirmed'}>
                <option value="unconfirmed" disabled>Not confirmed — choose a status</option><option value="available">Available</option><option value="limited">Limited availability</option><option value="on_request">Confirm on request</option><option value="out_of_stock">Currently unavailable</option>
              </select></label>
              <label>Availability note (optional)<input name="availability_note" maxLength={240} defaultValue={listing.availability_note || ''} placeholder="e.g. Delivery in 3–5 days" /></label>
              <button className="button button-small button-dark" type="submit" disabled={busy}>Update availability</button>
              {listing.availability_updated_at && <small>Supplier updated {dateText(listing.availability_updated_at)}</small>}
            </form>}
          </td>
          <td>{dateText(listing.created_at)}</td>
        </tr>
        {galleryListingId === listing.id && <tr key={`${listing.id}-gallery`}><td colSpan={6}>
          <div className="supplier-gallery-manager">
            <div><strong>Additional listing photos</strong><p>Upload up to four extra photos. JPEG, PNG or WebP only; maximum 4 MB per photo. Approved listings must be paused first.</p></div>
            {listing.gallery_images?.length ? <div className="supplier-gallery-thumbnails">{listing.gallery_images.map((photo) => <div className="supplier-gallery-photo" key={photo.id}>{photo.image_url ? <img src={photo.image_url} alt={`${listing.title} gallery photo`} /> : <span>Preview unavailable</span>}<button type="button" className="button button-small button-secondary" disabled={busy} onClick={() => void removeGalleryImage(listing, photo)}>Remove</button></div>)}</div> : <p className="admin-footnote">No additional photos added.</p>}
            {listing.status !== 'approved' && (listing.gallery_images?.length || 0) < 4 && <form className="supplier-gallery-upload" onSubmit={(event) => void uploadGalleryImages(event, listing)}>
              <label>Choose additional photos<input type="file" name="images" multiple required accept="image/jpeg,image/png,image/webp" /></label>
              <button className="button button-small" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload photos'}</button>
            </form>}
          </div>
        </td></tr>}
      </Fragment>)}</tbody></table></div> : <div className="admin-empty">No catalogue listings submitted yet.</div>}
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
        {offer.customer.contact_released && <section className="rnx-commercial-quote-panel" aria-label="Commercial quotation workspace">
          <div><strong>Commercial quotation</strong><p>Send the customer a priced proposal with clear scope, delivery terms and validity. This is separate from the RNX introduction fee.</p></div>
          {offer.quotes.map((quote) => <article className="rnx-quote-record" key={quote.id}>
            <div className="rnx-quote-record-heading"><strong>{quote.quote_reference} · {quote.title}</strong><span className={`admin-state-${quote.status === 'selected' ? 'good' : quote.status === 'submitted' ? 'wait' : quote.status === 'declined' || quote.status === 'withdrawn' ? 'bad' : 'wait'}`}>{quote.status.replaceAll('_', ' ')}</span></div>
            <strong className="rnx-quote-amount">{money(quote.total_amount, quote.currency)}</strong>
            <p>{quote.scope_description}</p>
            <small>Fulfilment: {quote.estimated_fulfilment || 'Not stated'} · Valid until {dateText(quote.valid_until)}</small>
            <p className="rnx-quote-terms">{quote.delivery_terms}</p>
            {quote.status === 'submitted' && <button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => void withdrawCommercialQuote(quote.id)}>Withdraw quotation</button>}
            {quote.status === 'selected' && <p className="form-status">The customer marked this proposal as preferred. Confirm the final agreement and payment directly with the customer.</p>}
            {quote.status === 'not_selected' && <small>The customer selected another quotation for this request.</small>}
          </article>)}
          {!offer.quotes.some((quote) => quote.status === 'submitted' || quote.status === 'selected') && !['completed','cancelled','disputed'].includes(offer.outcome?.status || '') && <form className="rnx-commercial-quote-form" onSubmit={(event) => void submitCommercialQuote(event, offer.id)}>
            <h4>{offer.quotes.length ? 'Submit a revised quotation' : 'Prepare a commercial quotation'}</h4>
            <label>Quote title<input name="quote_title" required minLength={3} maxLength={120} placeholder="e.g. Supply and delivery proposal" /></label>
            <label>Scope and specifications<textarea name="scope_description" required minLength={20} maxLength={3000} rows={4} placeholder="Describe exactly what is included, quantities, specifications and exclusions." /></label>
            <div className="rnx-quote-form-row"><label>Total quoted amount<input name="total_amount" required type="number" min="0" max="100000000000" step="0.01" inputMode="decimal" /></label><label>Currency<select name="currency" defaultValue="NGN"><option value="NGN">NGN — Naira</option><option value="USD">USD — US dollar</option><option value="GBP">GBP — Pound sterling</option><option value="EUR">EUR — Euro</option></select></label></div>
            <label>Delivery, payment and other terms<textarea name="delivery_terms" required minLength={2} maxLength={1200} rows={3} placeholder="State delivery fees, payment schedule, warranty/returns where applicable and any conditions." /></label>
            <div className="rnx-quote-form-row"><label>Estimated fulfilment<input name="estimated_fulfilment" maxLength={160} placeholder="e.g. 5–7 working days" /></label><label>Quote validity<select name="valid_days" defaultValue="14"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option></select></label></div>
            <button className="button button-small" type="submit" disabled={busy}>{busy ? 'Submitting quotation…' : 'Send quotation to customer'}</button>
          </form>}
          <small className="rnx-quote-disclaimer">RNX records the proposal and customer preference only. RNX does not collect this commercial payment or guarantee price, quality, delivery or fulfilment.</small>
        </section>}
        {offer.customer.contact_released && <div className="supplier-transaction-outcome">
          <strong>Transaction outcome</strong>
          <p>{offer.outcome?.status === 'completed' ? 'Both parties confirmed completion. The customer may submit a verified review.' : offer.outcome?.status === 'cancelled' ? 'Both parties confirmed that the transaction was not completed.' : offer.outcome?.status === 'disputed' ? 'The customer and supplier recorded different outcomes. RNX Operations may review the discrepancy.' : offer.outcome?.supplier_outcome ? `Your confirmation: ${offer.outcome.supplier_outcome.replaceAll('_', ' ')} · Awaiting customer confirmation.` : 'Confirm the transaction outcome after dealing with the customer.'}</p>
          {!offer.outcome?.supplier_outcome && <div className="supplier-offer-actions"><button className="button button-small" type="button" disabled={busy} onClick={() => void confirmOfferOutcome(offer.id, 'confirm_completed')}>Confirm completed</button><button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => void confirmOfferOutcome(offer.id, 'confirm_not_completed')}>Not completed</button></div>}
        </div>}
        {offer.review?.moderation_status === 'approved' && <div className="supplier-public-review"><strong>Verified customer review · {offer.review.rating}/5</strong><b>{offer.review.title}</b><p>{offer.review.body}</p>{offer.review.supplier_response ? <p>Your public response: {offer.review.supplier_response}</p> : <form onSubmit={(event) => void respondToReview(event, offer.review!.id)}><label>Public response<textarea rows={3} maxLength={1000} value={reviewReplyDrafts[offer.review.id] || ''} onChange={(event) => setReviewReplyDrafts((current) => ({ ...current, [offer.review!.id]: event.target.value }))} placeholder="Respond professionally to the customer's published review." /></label><button className="button button-small" type="submit" disabled={busy || (reviewReplyDrafts[offer.review.id] || '').trim().length < 2}>Publish response</button></form>}</div>}
      </article>)}</div> : <div className="admin-empty">No opportunity offers have been assigned to this supplier.</div>}
    </section>
  </section>;
}
