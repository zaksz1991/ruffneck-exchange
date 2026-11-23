'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminMatchAssistant } from '@/components/admin-match-assistant';

type Supplier = {
  id: string; business_name: string; contact_name: string; email: string; phone: string;
  business_type: string; category: string; state: string; status: string; created_at: string;
};
type ApprovedSupplier = { id: string; business_name: string; category: string; state: string; status: string };
type Listing = {
  id: string; title: string; listing_type: string; category: string; state: string;
  status: string; created_at: string; supplier: { business_name: string; status: string };
};
type Lead = {
  id: string; request_type: string; name: string; email: string | null; phone: string;
  state: string; city: string | null; category: string; details: string;
  referenced_listing_id: string | null; referenced_listing_slug: string | null;
  referenced_listing_title: string | null; referenced_supplier_name: string | null;
  preferred_contact: string; status: string; contact_release_status: string; created_at: string;
};
type Offer = {
  id: string; lead_id: string; supplier_application_id: string; anonymised_summary: string;
  quoted_fee: number; currency: string; payment_status: string; payment_reference: string | null;
  supplier_accepted_at: string | null; supplier_declined_at?: string | null; payment_verified_at: string | null; payment_amount: number | null; customer_approved_at: string | null; customer_declined_at: string | null;
  contact_released_at: string | null; customer_approval_token_expires_at: string | null; created_at: string;
  supplier: { business_name: string };
  lead: { name: string; phone: string; email: string | null; category: string; state: string; city: string | null };
};
type Overview = {
  suppliers: Supplier[]; approvedSuppliers: ApprovedSupplier[]; listings: Listing[];
  leads: Lead[]; offers: Offer[];
  counts: { suppliers: number; listings: number; leads: number; offers: number };
};

const leadStatuses = ['new', 'qualifying', 'qualified', 'matched', 'closed', 'invalid'];
function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}
function money(value: number, currency = 'NGN') {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return `${currency} ${Number(value).toLocaleString('en-NG')}`; }
}

export function AdminConsole() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [offerLeadId, setOfferLeadId] = useState('');
  const [offerSupplierId, setOfferSupplierId] = useState('');
  const [offerSummary, setOfferSummary] = useState('');
  const [offerFee, setOfferFee] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState('');
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load operations data.');
      setData(result as Overview);
      setOfferLeadId((current) => current || (result.leads?.find((lead: Lead) => ['qualified', 'matched'].includes(lead.status))?.id ?? ''));
      setOfferSupplierId((current) => current || (result.approvedSuppliers?.[0]?.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load operations data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function update(resource: 'supplier' | 'listing' | 'lead', id: string, status: string) {
    setBusyId(id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/actions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource, id, status }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'The update could not be saved.');
      setNotice(result.message || 'Update saved.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'The update could not be saved.'); }
    finally { setBusyId(''); }
  }

  async function createOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setOfferBusy(true); setError(''); setNotice(''); setApprovalUrl('');
    try {
      const response = await fetch('/api/admin/offers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: offerLeadId, supplierId: offerSupplierId, anonymisedSummary: offerSummary, quotedFee: offerFee }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'The supplier offer could not be prepared.');
      setApprovalUrl(result.approvalUrl);
      setOfferSummary(''); setOfferFee('');
      setNotice(`Supplier offer created. The customer approval link expires ${dateLabel(result.expiresAt)}.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'The supplier offer could not be prepared.'); }
    finally { setOfferBusy(false); }
  }

  async function offerAction(id: string, action: string, extra: Record<string, string> = {}) {
    setBusyId(id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/offers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'The offer update could not be saved.');
      if (result.approvalUrl) setApprovalUrl(result.approvalUrl);
      setNotice(result.message || 'Offer updated.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'The offer update could not be saved.'); }
    finally { setBusyId(''); }
  }

  async function copyApprovalLink() {
    if (!approvalUrl) return;
    try { await navigator.clipboard.writeText(approvalUrl); setNotice('Customer approval link copied. Send it through the customer’s preferred contact channel.'); }
    catch { setError('Clipboard access was blocked. Select and copy the link from the field.'); }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/admin/login');
  }

  const eligibleLeads = useMemo(() => data?.leads.filter((lead) => ['qualified', 'matched'].includes(lead.status) && lead.contact_release_status !== 'released') ?? [], [data]);
  const selectedLead = data?.leads.find((lead) => lead.id === offerLeadId);

  return <section className="admin-console">
    <div className="admin-toolbar"><div><span className="admin-private-tag">PRIVATE · AUTHORISED ACCESS</span><p>Personal data is restricted to this operations console. Refresh after external payment or customer actions.</p></div><div className="admin-toolbar-actions"><button className="button button-small button-dark" type="button" onClick={() => void refresh()} disabled={loading}>Refresh queue</button><button className="button button-small" type="button" onClick={() => void logout()}>Sign out</button></div></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !data ? <div className="empty-state">Loading private operations data…</div> : null}
    {data && <>
      <div className="admin-stat-grid admin-stat-grid-four">
        <article><span>Pending suppliers</span><strong>{data.counts.suppliers}</strong></article>
        <article><span>Pending listings</span><strong>{data.counts.listings}</strong></article>
        <article><span>Open customer leads</span><strong>{data.counts.leads}</strong></article>
        <article><span>Supplier offers</span><strong>{data.counts.offers}</strong></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">BUSINESS REVIEW</p><h2>Supplier applications</h2></div><span>{data.suppliers.length} awaiting review</span></div>
        {data.suppliers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Contact</th><th>Category / location</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{data.suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.business_name}</strong><small>{supplier.business_type}</small></td><td><strong>{supplier.contact_name}</strong><small>{supplier.email}</small><small>{supplier.phone}</small></td><td>{supplier.category}<small>{supplier.state}</small></td><td>{dateLabel(supplier.created_at)}</td><td className="admin-actions"><button type="button" disabled={!!busyId} onClick={() => void update('supplier', supplier.id, 'approved')}>Approve</button><button className="reject" type="button" disabled={!!busyId} onClick={() => void update('supplier', supplier.id, 'rejected')}>Reject</button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No pending supplier applications.</div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">CATALOGUE REVIEW</p><h2>Product and service listings</h2></div><span>{data.listings.length} awaiting review</span></div>
        {data.listings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Offer</th><th>Supplier</th><th>Category / location</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{data.listings.map((listing) => <tr key={listing.id}><td><strong>{listing.title}</strong><small>{listing.listing_type}</small></td><td>{listing.supplier?.business_name || 'Supplier record unavailable'}<small>Supplier status: {listing.supplier?.status || 'unknown'}</small></td><td>{listing.category}<small>{listing.state}</small></td><td>{dateLabel(listing.created_at)}</td><td className="admin-actions"><button type="button" disabled={!!busyId || listing.supplier?.status !== 'approved'} title={listing.supplier?.status !== 'approved' ? 'Approve the supplier first' : 'Approve listing'} onClick={() => void update('listing', listing.id, 'approved')}>Approve</button><button className="reject" type="button" disabled={!!busyId} onClick={() => void update('listing', listing.id, 'rejected')}>Reject</button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No pending catalogue listings.</div>}
        <p className="admin-footnote">A listing can only be approved after its supplier application is approved. Each offer is reviewed separately.</p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">CUSTOMER ACQUISITION</p><h2>Lead qualification queue</h2></div><span>{data.leads.length} recent requests</span></div>
        {data.leads.length ? <div className="admin-table-wrap"><table className="admin-table admin-lead-table"><thead><tr><th>Customer / contact</th><th>Requirement</th><th>Location</th><th>Created</th><th>Workflow</th></tr></thead><tbody>{data.leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small>{lead.phone}</small><small>{lead.email || 'No email provided'}</small><small>Preferred: {lead.preferred_contact}</small></td><td><strong>{lead.category}</strong><small>{lead.request_type}</small>{lead.referenced_listing_title && <small className="lead-offer-reference">Published offer: {lead.referenced_listing_title} · {lead.referenced_supplier_name || 'Supplier snapshot'}</small>}<details><summary>View requirement</summary><p>{lead.details}</p></details></td><td>{[lead.city, lead.state].filter(Boolean).join(', ')}</td><td>{dateLabel(lead.created_at)}</td><td><select aria-label={`Status for lead ${lead.id}`} value={lead.status} disabled={!!busyId} onChange={(event) => void update('lead', lead.id, event.target.value)}>{leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><small>Contact release: {lead.contact_release_status}</small></td></tr>)}</tbody></table></div> : <div className="admin-empty">No customer requests have been submitted.</div>}
        <p className="admin-footnote">Qualify the requirement before matching. Changing a workflow status never releases customer contact details.</p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">SUPPLIER MATCHING</p><h2>Prepare an opportunity offer</h2></div><span>Customer remains anonymous</span></div>
        {eligibleLeads.length && data.approvedSuppliers.length ? <form className="admin-offer-form" onSubmit={(event) => void createOffer(event)}>
          <label>Qualified customer request<select value={offerLeadId} onChange={(event) => { setOfferLeadId(event.target.value); setOfferSupplierId(''); }} required><option value="">Choose a qualified request</option>{eligibleLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.category}{lead.referenced_listing_title ? ` · Offer: ${lead.referenced_listing_title}` : ''} · {[lead.city, lead.state].filter(Boolean).join(', ')} · {lead.name} ({lead.status})</option>)}</select></label>
          <AdminMatchAssistant leadId={offerLeadId} selectedSupplierId={offerSupplierId} onSelectSupplier={setOfferSupplierId} />
          <label>Approved supplier<select value={offerSupplierId} onChange={(event) => setOfferSupplierId(event.target.value)} required><option value="">Choose an approved supplier</option>{data.approvedSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.business_name} · {supplier.category} · {supplier.state}</option>)}</select></label>
          <label>Proposed supplier lead fee (NGN)<input type="number" min="0" max="100000000" step="0.01" value={offerFee} onChange={(event) => setOfferFee(event.target.value)} placeholder="e.g. 5000" required /></label>
          <label className="admin-offer-summary">Anonymised opportunity brief<textarea rows={4} minLength={30} maxLength={1200} value={offerSummary} onChange={(event) => setOfferSummary(event.target.value)} placeholder="Describe the requirement without the customer's name, phone number, email or other identifying details." required /></label>
          <div className="admin-offer-submit"><button className="button" type="submit" disabled={offerBusy || !offerLeadId || !offerSupplierId}>{offerBusy ? 'Preparing offer…' : 'Create offer and approval link'}</button><p>Consent link expires after seven days. Send it only after the supplier has accepted and payment has been verified.</p></div>
          {selectedLead && <p className="admin-footnote">Selected request will be offered without identifying details. Customer: {selectedLead.name}. Preferred channel: {selectedLead.preferred_contact}.{selectedLead.referenced_listing_title ? ` Customer originally enquired about: ${selectedLead.referenced_listing_title} — ${selectedLead.referenced_supplier_name || 'supplier snapshot'}. Reconfirm availability before representing this as a live offer.` : ''}</p>}
        </form> : <div className="admin-empty">To prepare an offer, first qualify a customer request and approve at least one supplier.</div>}
        {approvalUrl && <div className="admin-link-box"><strong>Customer approval link</strong><p>Copy this link and send it privately to the customer. Do not publish it or send it to a supplier.</p><div><input readOnly value={approvalUrl} aria-label="Customer approval link" /><button type="button" className="button button-small" onClick={() => void copyApprovalLink()}>Copy link</button></div></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">INTRODUCTION CONTROL</p><h2>Supplier offers, consent and payment</h2></div><span>{data.offers.length} recorded offers</span></div>
        {data.offers.length ? <div className="admin-table-wrap"><table className="admin-table admin-offer-table"><thead><tr><th>Customer / supplier</th><th>Opportunity / fee</th><th>Customer decision</th><th>Payment</th><th>Contact release</th><th>Actions</th></tr></thead><tbody>{data.offers.map((offer) => <tr key={offer.id}>
          <td><strong>{offer.lead?.name || 'Customer'}</strong><small>{offer.lead?.phone}</small><small>{offer.supplier?.business_name || 'Supplier'}</small><small>{dateLabel(offer.created_at)}</small></td>
          <td><strong>{offer.lead?.category}</strong><small>{money(offer.quoted_fee, offer.currency)}</small><details><summary>View anonymised brief</summary><p>{offer.anonymised_summary}</p></details></td>
          <td>{offer.customer_approved_at ? <span className="admin-state-good">Approved</span> : offer.customer_declined_at ? <span className="admin-state-bad">Declined</span> : <span className="admin-state-wait">Awaiting consent</span>}<small>{dateLabel(offer.customer_approved_at || offer.customer_declined_at)}</small><small>Supplier: {offer.supplier_accepted_at ? 'Accepted' : offer.supplier_declined_at ? 'Declined' : 'Awaiting acceptance'}</small>{!offer.customer_approved_at && !offer.customer_declined_at && !offer.supplier_declined_at && <button className="admin-mini-action" type="button" disabled={!!busyId} onClick={() => void offerAction(offer.id, 'regenerate_consent_link')}>Generate fresh consent link</button>}</td>
          <td><strong>{offer.payment_status}</strong><small>Ref: {offer.payment_reference || '—'}</small><small>Amount: {offer.payment_amount == null ? '—' : money(offer.payment_amount, offer.currency)}</small>{offer.payment_status !== 'paid' && offer.payment_status !== 'refunded' && offer.payment_status !== 'credited' && <div className="admin-payment-input"><input type="number" min="0" step="0.01" aria-label={`Payment amount for ${offer.id}`} value={paymentAmounts[offer.id] || ''} onChange={(event) => setPaymentAmounts((current) => ({ ...current, [offer.id]: event.target.value }))} placeholder={`Amount (${offer.currency})`} /><input aria-label={`Payment reference for ${offer.id}`} value={paymentRefs[offer.id] || ''} onChange={(event) => setPaymentRefs((current) => ({ ...current, [offer.id]: event.target.value }))} placeholder="Verified transaction ref" /><button className="admin-mini-action" type="button" disabled={!!busyId || !offer.supplier_accepted_at || (paymentRefs[offer.id] || '').trim().length < 3 || (paymentAmounts[offer.id] || '').trim() === ''} onClick={() => void offerAction(offer.id, 'verify_payment', { paymentReference: paymentRefs[offer.id].trim(), paymentAmount: paymentAmounts[offer.id] })}>Verify paid</button></div>}</td>
          <td>{offer.contact_released_at ? <span className="admin-state-good">Recorded as shared</span> : <span className="admin-state-wait">Not released</span>}<small>{dateLabel(offer.contact_released_at)}</small></td>
          <td className="admin-actions"><button type="button" disabled={!!busyId || !!offer.supplier_accepted_at || !!offer.supplier_declined_at || !!offer.customer_declined_at || !!offer.contact_released_at || ['refunded', 'credited'].includes(offer.payment_status)} onClick={() => void offerAction(offer.id, 'record_supplier_acceptance')}>Record supplier acceptance</button><button type="button" disabled={!!busyId || !offer.payment_verified_at || !offer.customer_approved_at || !!offer.contact_released_at} title={!offer.payment_verified_at ? 'Verify payment first' : !offer.customer_approved_at ? 'Customer consent is required' : 'Record after actually sharing contact details'} onClick={() => void offerAction(offer.id, 'record_contact_release')}>Record contact shared</button>{offer.payment_status === 'paid' && !offer.contact_released_at && <><button className="reject" type="button" disabled={!!busyId} onClick={() => void offerAction(offer.id, 'record_refund')}>Record refund</button><button className="reject" type="button" disabled={!!busyId} onClick={() => void offerAction(offer.id, 'record_credit')}>Record credit</button></>}</td>
        </tr>)}</tbody></table></div> : <div className="admin-empty">No supplier offers have been created.</div>}
        <p className="admin-footnote">First record the supplier's acceptance of the anonymised brief and quoted fee. Verify the exact payment amount and transaction reference against the bank or payment provider. A screenshot or customer claim is not proof. Share customer details manually only after payment verification and explicit customer consent; record the release after it has actually happened.</p>
      </section>
    </>}
  </section>;
}
