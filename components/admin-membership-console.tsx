'use client';
import { useCallback, useEffect, useState } from 'react';

type Supplier = { id: string; business_name: string; email: string; phone: string; portal_access: boolean; invite_pending: boolean };
type Payment = { id: string; amount: number; currency: string; payment_method: string; transaction_reference: string; status: string; supplier_note: string | null; received_amount: number | null; received_currency: string | null; verified_reference: string | null; verified_at: string | null; created_at: string };
type Membership = { id: string; status: string; quoted_amount: number | null; currency: string; billing_interval: string; quote_expires_at: string | null; created_at: string; supplier: { id: string; business_name: string; email: string; phone: string; status: string }; plan: { code: string; name: string; listing_limit: number }; payments: Payment[] };
function dateText(value?: string | null) { return value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function money(value: number | null, currency = 'NGN') { if (value === null) return 'Not quoted'; return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }

export function AdminMembershipConsole() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [intervals, setIntervals] = useState<Record<string, string>>({});
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({});
  const [verifiedReferences, setVerifiedReferences] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/memberships', { cache: 'no-store' });
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Membership information could not be loaded.');
      setMemberships(result.subscriptions || []); setSuppliers(result.suppliers || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Membership information could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function action(id: string, payload: Record<string, unknown>) {
    setBusy(id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/memberships/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Membership update failed.');
      setNotice(result.message || 'Membership updated.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Membership update failed.'); }
    finally { setBusy(''); }
  }

  async function issueInvite(supplierId: string) {
    setBusy(supplierId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/invite`, { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Activation link could not be generated.');
      setInviteUrls((current) => ({ ...current, [supplierId]: result.url }));
      setNotice(`Portal activation link generated. It expires ${dateText(result.expiresAt)}. Send it privately to the supplier using the verified business email on record.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Activation link could not be generated.'); }
    finally { setBusy(''); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Link copied. Send it privately to the approved supplier.'); }
    catch { setError('Clipboard access was blocked. Select and copy the link manually.'); }
  }

  return <section className="admin-console">
    <div className="admin-toolbar"><div><span className="admin-private-tag">PRIVATE · MEMBERSHIP OPERATIONS</span><p>Manual commercial review. A supplier-submitted payment reference is not proof of receipt.</p></div><button className="button button-small button-dark" type="button" onClick={() => void refresh()} disabled={loading}>Refresh records</button></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !memberships.length && !suppliers.length ? <div className="empty-state">Loading membership records…</div> : <>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">COMMERCIAL REVIEW</p><h2>Membership requests and billing</h2></div><span>{memberships.length} records</span></div>
        {memberships.length ? <div className="admin-table-wrap"><table className="admin-table membership-admin-table"><thead><tr><th>Supplier / plan</th><th>Membership status</th><th>Quotation</th><th>Supplier payment submission</th><th>Operations</th></tr></thead><tbody>{memberships.map((membership) => <tr key={membership.id}>
          <td><strong>{membership.supplier?.business_name}</strong><small>{membership.supplier?.email}</small><small>{membership.plan?.name} · limit {membership.plan?.listing_limit}</small><small>Requested {dateText(membership.created_at)}</small></td>
          <td><span className={`admin-state-${membership.status === 'active' ? 'good' : ['rejected','cancelled','expired'].includes(membership.status) ? 'bad' : 'wait'}`}>{membership.status}</span><small>{membership.billing_interval}</small><small>Quote expires {dateText(membership.quote_expires_at)}</small></td>
          <td><strong>{money(membership.quoted_amount, membership.currency)}</strong>{['requested','awaiting_payment'].includes(membership.status) && <div className="admin-payment-input"><input type="number" min="1" step="0.01" value={quotes[membership.id] ?? (membership.quoted_amount ? String(membership.quoted_amount) : '')} onChange={(event) => setQuotes((v) => ({ ...v, [membership.id]: event.target.value }))} placeholder="Quote amount in NGN" /><select value={intervals[membership.id] ?? membership.billing_interval} onChange={(event) => setIntervals((v) => ({ ...v, [membership.id]: event.target.value }))}><option value="monthly">Monthly</option><option value="annual">Annual</option></select><button className="admin-mini-action" type="button" disabled={!!busy || !(Number(quotes[membership.id] ?? membership.quoted_amount) > 0)} onClick={() => void action(membership.id, { action: 'quote', amount: quotes[membership.id] ?? membership.quoted_amount, interval: intervals[membership.id] ?? membership.billing_interval, validityDays: 7 })}>Issue / update quotation</button></div>}</td>
          <td>{membership.payments?.length ? membership.payments.map((payment) => <div className="membership-payment-record" key={payment.id}><strong>{payment.status}</strong><small>Expected under quote: {money(payment.amount, payment.currency)} · {payment.payment_method}</small><small>Supplier-reported reference: {payment.transaction_reference}</small><small>{dateText(payment.created_at)}</small>{payment.verified_at && <small>Verified receipt: {money(payment.received_amount, payment.received_currency || payment.currency)} · Ref {payment.verified_reference || '—'}</small>}{payment.supplier_note && <small>Note: {payment.supplier_note}</small>}{payment.status === 'pending' && <div className="membership-payment-actions membership-verify-fields"><label>Actual amount received (NGN)<input type="number" min="0.01" step="0.01" value={receivedAmounts[payment.id] ?? ''} onChange={(event) => setReceivedAmounts((v) => ({ ...v, [payment.id]: event.target.value }))} placeholder="Check bank statement" /></label><label>Actual bank/provider reference<input value={verifiedReferences[payment.id] ?? ''} onChange={(event) => setVerifiedReferences((v) => ({ ...v, [payment.id]: event.target.value }))} minLength={3} maxLength={120} placeholder="Confirmed transaction ID" /></label><div className="membership-payment-actions"><button type="button" disabled={!!busy || !(Number(receivedAmounts[payment.id]) > 0) || (verifiedReferences[payment.id] || '').trim().length < 3} onClick={() => void action(membership.id, { action: 'verify_payment', paymentId: payment.id, receivedAmount: receivedAmounts[payment.id], receivedCurrency: 'NGN', verifiedReference: verifiedReferences[payment.id] })}>Verify actual receipt</button><button type="button" className="reject" disabled={!!busy} onClick={() => void action(membership.id, { action: 'reject_payment', paymentId: payment.id, reason: 'Reference or amount could not be verified.' })}>Reject</button></div></div>}</div>) : <span>None submitted</span>}</td>
          <td className="admin-actions">{['requested','awaiting_payment'].includes(membership.status) && <button className="reject" type="button" disabled={!!busy} onClick={() => void action(membership.id, { action: 'reject_request', reason: 'RNX operations decision.' })}>Reject request</button>}{membership.status === 'active' && <button className="reject" type="button" disabled={!!busy} onClick={() => void action(membership.id, { action: 'cancel_membership' })}>Cancel membership</button>}</td>
        </tr>)}</tbody></table></div> : <div className="admin-empty">No supplier membership records were found.</div>}
        <p className="admin-footnote">Only mark a transaction verified after checking the actual bank or payment-provider account. Enter the amount and transaction reference visible in that receiving account; the database compares the independently entered receipt amount and currency with RNX's quote before activating the plan. This console does not receive or process funds.</p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">SUPPLIER ACCESS</p><h2>Existing supplier portal activation</h2></div><span>{suppliers.length} approved suppliers</span></div>
        {suppliers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Contact email</th><th>Portal access</th><th>Activation</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.business_name}</strong><small>{supplier.phone}</small></td><td>{supplier.email}</td><td>{supplier.portal_access ? <span className="admin-state-good">Enabled</span> : <span className="admin-state-wait">Not activated</span>}</td><td>{supplier.portal_access ? <span>Supplier can sign in</span> : <button type="button" className="button button-small" disabled={!!busy} onClick={() => void issueInvite(supplier.id)}>{supplier.invite_pending ? 'Generate replacement link' : 'Issue activation link'}</button>}{inviteUrls[supplier.id] && <div className="admin-link-box"><input readOnly value={inviteUrls[supplier.id]} aria-label={`Activation link for ${supplier.business_name}`} /><button type="button" className="button button-small" onClick={() => void copy(inviteUrls[supplier.id])}>Copy</button></div>}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No approved suppliers yet.</div>}
        <p className="admin-footnote">New applicants set a password during registration. Their portal is enabled after approval. Older supplier records without a password need a one-time activation link. Links expire after seven days; send them privately to the approved business contact.</p>
      </section>
    </>}
  </section>;
}
