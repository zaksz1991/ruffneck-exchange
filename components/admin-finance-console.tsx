'use client';

import { useCallback, useEffect, useState } from 'react';

type Offer = {
  id: string; lead_id: string; supplier_application_id: string; anonymised_summary: string; quoted_fee: number; currency: string;
  payment_status: string; payment_reference: string | null; payment_amount: number | null; supplier_accepted_at: string | null;
  payment_verified_at: string | null; customer_approved_at: string | null; customer_declined_at: string | null; contact_released_at: string | null;
  created_at: string; supplier: { business_name: string }; lead: { request_type: string; category: string; state: string; city: string | null; status: string };
};
function stamp(value: string | null) { return value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function money(value: number | null, currency: string) { try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); } catch { return `${currency} ${Number(value || 0).toLocaleString('en-NG')}`; } }

export function AdminFinanceConsole() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/offers', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Payment records could not be loaded.');
      setOffers(result.offers || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Payment records could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function act(offer: Offer, action: 'verify_payment' | 'record_refund' | 'record_credit') {
    setBusy(offer.id); setError(''); setNotice('');
    try {
      const payload = action === 'verify_payment'
        ? { action, paymentReference: refs[offer.id]?.trim(), paymentAmount: amounts[offer.id] }
        : { action, reference: refs[offer.id]?.trim() || undefined };
      const response = await fetch(`/api/admin/offers/${offer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Payment action failed.');
      setNotice(result.message || 'Payment record updated.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Payment action failed.'); }
    finally { setBusy(''); }
  }

  return <section className="admin-panel">
    <div className="admin-panel-heading"><div><p className="eyebrow">FINANCE CONTROL</p><h2>Lead-fee payments</h2></div><span>{offers.length} records</span></div>
    <p className="muted">This view excludes customer names, phone numbers and email addresses. Verify the amount and transaction reference against the actual receiving-account record. A screenshot or supplier statement is not proof of receipt.</p>
    {notice && <p className="admin-state-good" role="status">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p className="admin-empty">Loading payment records…</p> : offers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Supplier / opportunity</th><th>Agreed fee</th><th>Payment status</th><th>Verification</th><th>Introduction gate</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}>
      <td><strong>{offer.supplier?.business_name || 'Supplier'}</strong><small>{offer.lead?.category} · {offer.lead?.request_type}</small><small>{offer.lead?.city ? `${offer.lead.city}, ` : ''}{offer.lead?.state}</small><details><summary>View anonymised brief</summary><p>{offer.anonymised_summary}</p></details></td>
      <td><strong>{money(offer.quoted_fee, offer.currency)}</strong><small>{stamp(offer.created_at)}</small></td>
      <td><strong>{offer.payment_status}</strong><small>Received: {offer.payment_amount == null ? '—' : money(offer.payment_amount, offer.currency)}</small><small>Reference: {offer.payment_reference || '—'}</small></td>
      <td>{offer.payment_status !== 'paid' && !['refunded','credited'].includes(offer.payment_status) ? <div className="admin-payment-input"><input type="number" min="0" step="0.01" aria-label={`Received amount for ${offer.id}`} value={amounts[offer.id] || ''} onChange={(event) => setAmounts((current) => ({ ...current, [offer.id]: event.target.value }))} placeholder="Actual amount received" /><input aria-label={`Verified reference for ${offer.id}`} value={refs[offer.id] || ''} onChange={(event) => setRefs((current) => ({ ...current, [offer.id]: event.target.value }))} placeholder="Verified transaction reference" /><button className="admin-mini-action" type="button" disabled={!!busy || !offer.supplier_accepted_at || !refs[offer.id]?.trim() || !amounts[offer.id]} onClick={() => void act(offer, 'verify_payment')}>Verify receipt</button></div> : <span className="admin-state-good">{offer.payment_status}</span>}{offer.payment_verified_at && <small>{stamp(offer.payment_verified_at)}</small>}</td>
      <td><small>Supplier accepted: {offer.supplier_accepted_at ? 'Yes' : 'No'}</small><small>Customer consent: {offer.customer_approved_at ? 'Approved' : offer.customer_declined_at ? 'Declined' : 'Pending'}</small><small>Contact recorded shared: {offer.contact_released_at ? 'Yes' : 'No'}</small>{offer.payment_status === 'paid' && !offer.contact_released_at && <div className="admin-actions"><button type="button" className="reject" disabled={!!busy} onClick={() => void act(offer, 'record_refund')}>Record refund</button><button type="button" disabled={!!busy} onClick={() => void act(offer, 'record_credit')}>Record credit</button></div>}</td>
    </tr>)}</tbody></table></div> : <p className="admin-empty">No lead-fee offers have been created.</p>}
    <p className="admin-footnote">Recording a refund or credit is an administrative record only. It does not send money or execute a bank reversal. Customer contact release remains a separate operations action and requires recorded supplier acceptance, verified payment and customer approval.</p>
  </section>;
}
