'use client';

import { useEffect, useState } from 'react';

type Offer = {
  supplierName: string;
  supplierCategory: string;
  supplierState: string;
  requirementCategory: string;
  requirementLocation: string;
  summary: string;
  decision: 'pending' | 'approved' | 'declined';
};

export function IntroductionApproval({ token }: { token: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        setError('This approval link is invalid.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/customer/introduction?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'The supplier introduction could not be loaded.');
        if (active) setOffer(result.offer as Offer);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'The supplier introduction could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  async function decide(decision: 'approved' | 'declined') {
    setBusy(true);
    setError('');
    setMessage('Saving your response…');
    try {
      const response = await fetch('/api/customer/introduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your response could not be saved.');
      setOffer((current) => current ? { ...current, decision: result.decision } : current);
      setMessage(decision === 'approved'
        ? 'Your approval has been recorded. Contact details remain locked until the agreed supplier fee is verified.'
        : 'Your decision has been recorded. Your contact details will not be released for this introduction.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your response could not be saved.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell container narrow-shell approval-shell">
    <div className="page-intro"><p className="eyebrow">CUSTOMER AUTHORISATION</p><h1>Review this supplier introduction.</h1><p>Your contact information will not be shared simply because you submitted a request. Review the proposed supplier and decide whether you authorise this specific introduction.</p></div>
    {loading && <div className="approval-card">Loading introduction details…</div>}
    {error && <div className="admin-error" role="alert">{error}</div>}
    {offer && <section className="approval-card">
      <div className="approval-status"><span>PROPOSED SUPPLIER</span><strong>{offer.supplierName}</strong><p>{offer.supplierCategory} · {offer.supplierState}</p></div>
      <div className="approval-detail-grid"><div><span>Your requirement</span><strong>{offer.requirementCategory}</strong></div><div><span>Request location</span><strong>{offer.requirementLocation}</strong></div></div>
      <div className="approval-summary"><h2>What the supplier is being offered</h2><p>{offer.summary}</p></div>
      {offer.decision === 'approved' ? <div className="approval-success">You approved this introduction. Contact details remain protected until payment is verified and RuffNeck Exchange records the authorised release.</div>
        : offer.decision === 'declined' ? <div className="approval-declined">You declined this introduction. No contact details will be released to this supplier.</div>
        : <><p className="approval-consent-note">Approving authorises RuffNeck Exchange to introduce you to <strong>{offer.supplierName}</strong> for this requirement only. It does not authorise unrelated marketing or other supplier introductions.</p><div className="approval-actions"><button className="button" disabled={busy} onClick={() => void decide('approved')}>{busy ? 'Saving…' : 'Approve this introduction'}</button><button className="button button-secondary" disabled={busy} onClick={() => void decide('declined')}>Decline</button></div></>}
      {message && <p className="form-status" role="status">{message}</p>}
    </section>}
    <p className="approval-footnote">RuffNeck Exchange records this decision against this specific supplier offer. You can decline without charge. Customers do not pay a fee to approve an introduction. This link is private; do not forward it to another person.</p>
  </main>;
}
