'use client';

import { useCallback, useEffect, useState } from 'react';

type CaseMessage = { id: string; sender_role: string; sender_name: string; visibility: string; body: string; created_at: string };
type EvidenceAttachment = { id: string; uploader_role: string; visibility: string; file_name: string; mime_type: string; file_size_bytes: number; note: string | null; created_at: string };
type SupplierTrustCase = {
  id: string;
  case_reference: string;
  case_type: string;
  summary: string;
  description: string;
  requested_resolution: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  supplier_response_requested_at: string;
  can_respond: boolean;
  messages: CaseMessage[];
  attachments: EvidenceAttachment[];
};

function stamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}
function fileSize(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }
const label = (value: string) => value.replaceAll('_', ' ');

export function SupplierTrustCaseCentre() {
  const [cases, setCases] = useState<SupplierTrustCase[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [evidenceBusy, setEvidenceBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/supplier/trust-cases', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Supplier case responses could not be loaded.');
      setCases((result.cases || []) as SupplierTrustCase[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Supplier case responses could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (loading || typeof window === 'undefined' || !window.location.hash.startsWith('#supplier-trust-case-')) return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, cases]);

  async function submitResponse(caseId: string) {
    const body = (drafts[caseId] || '').trim();
    if (body.length < 10) return;
    setBusy(caseId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/supplier/trust-cases/${encodeURIComponent(caseId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Your response could not be sent.');
      setDrafts((current) => ({ ...current, [caseId]: '' }));
      setNotice(result.message || 'Your response was submitted.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your response could not be sent.');
    } finally {
      setBusy('');
    }
  }

  async function uploadEvidence(caseId: string, file: File | null) {
    if (!file) return;
    setEvidenceBusy(caseId); setError(''); setNotice('');
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch(`/api/supplier/trust-cases/${encodeURIComponent(caseId)}/attachments`, { method: 'POST', body: form });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Evidence upload failed.');
      setNotice(`${file.name} added to the case evidence.`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Evidence upload failed.'); }
    finally { setEvidenceBusy(''); }
  }

  return <section className="supplier-panel supplier-trust-case-centre" aria-label="Customer protection cases">
    <div className="supplier-section-heading">
      <div><p className="eyebrow">CUSTOMER PROTECTION</p><h2>Case response centre</h2><p>RNX may ask your business to respond to a customer complaint linked to an authorised introduction. Internal RNX notes and customer contact details are not shown here.</p></div>
      <button className="button button-small button-secondary" type="button" disabled={loading} onClick={() => void refresh()}>Refresh cases</button>
    </div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p className="admin-empty">Loading assigned cases…</p> : cases.length === 0 ? <div className="supplier-notifications-empty">No customer protection cases have been assigned to your business for a response.</div> : <div className="supplier-trust-case-list">
      {cases.map((trustCase) => <article className="supplier-trust-case-card" id={`supplier-trust-case-${trustCase.id}`} key={trustCase.id}>
        <div className="supplier-trust-case-heading">
          <div><p className="eyebrow">{trustCase.case_reference} · {label(trustCase.case_type)}</p><h3>{trustCase.summary}</h3><small>Received {stamp(trustCase.created_at)} · Updated {stamp(trustCase.updated_at)}</small></div>
          <span className={`customer-status${trustCase.status === 'awaiting_supplier' ? ' status-invalid' : ''}`}>{label(trustCase.status)}</span>
        </div>
        <div className="supplier-trust-case-report"><strong>Customer report</strong><p>{trustCase.description}</p>{trustCase.requested_resolution && <p><strong>Requested outcome:</strong> {trustCase.requested_resolution}</p>}</div>
        <div className="supplier-trust-case-messages"><h4>Customer-visible case conversation</h4>
          {trustCase.messages.length ? trustCase.messages.map((message) => <article className={`customer-message ${message.sender_role === 'supplier' ? 'is-supplier' : message.sender_role === 'staff' ? 'is-operations' : 'is-customer'}`} key={message.id}>
            <div><strong>{message.sender_name}</strong><small>{stamp(message.created_at)}</small></div><p>{message.body}</p>
          </article>) : <p className="fine-print">No customer-visible case messages have been recorded yet.</p>}
        </div>
        <div className="trust-evidence"><div className="trust-evidence-heading"><div><strong>Shared case evidence</strong><small>PDF or image files · maximum 4 MB each</small></div><span>{trustCase.attachments?.length || 0}/20</span></div>
          {(trustCase.attachments || []).length ? <div className="trust-evidence-list">{trustCase.attachments.map((attachment) => <article key={attachment.id}><div><strong>{attachment.file_name}</strong><small>{fileSize(attachment.file_size_bytes)} · {attachment.uploader_role} · {stamp(attachment.created_at)}</small>{attachment.note && <small>{attachment.note}</small>}</div><a className="button button-small button-secondary" href={`/api/supplier/trust-cases/${trustCase.id}/attachments/${attachment.id}`} target="_blank" rel="noreferrer">Open file</a></article>)}</div> : <p className="fine-print">No files have been shared on this case.</p>}
          {trustCase.can_respond && (trustCase.attachments?.length || 0) < 20 ? <label className="trust-evidence-upload">{evidenceBusy === trustCase.id ? 'Uploading evidence…' : 'Add supplier supporting evidence'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={evidenceBusy === trustCase.id} onChange={(event) => { const file = event.target.files?.[0] || null; void uploadEvidence(trustCase.id, file); event.currentTarget.value = ''; }} /><small>Upload records that support your factual response. Supplier evidence is visible to the customer and authorised RNX staff.</small></label> : null}
        </div>
        {trustCase.can_respond ? <form className="supplier-trust-case-compose" onSubmit={(event) => { event.preventDefault(); void submitResponse(trustCase.id); }}>
          <label htmlFor={`supplier-case-response-${trustCase.id}`}>Your response to the customer and RNX Operations<textarea id={`supplier-case-response-${trustCase.id}`} rows={4} minLength={10} maxLength={3000} value={drafts[trustCase.id] || ''} onChange={(event) => setDrafts((current) => ({ ...current, [trustCase.id]: event.target.value }))} placeholder="Address the issue factually. Include relevant dates, actions taken and any practical next steps. Do not include passwords, bank PINs or payment-card details." /></label>
          <div><small>10–3,000 characters. Your response will be visible to the customer and authorised RNX staff.</small><button className="button button-small" type="submit" disabled={busy === trustCase.id || (drafts[trustCase.id] || '').trim().length < 10}>{busy === trustCase.id ? 'Submitting response…' : 'Submit response'}</button></div>
        </form> : <p className="supplier-trust-case-readonly">Your latest response window is not open. RNX Operations has received the current response or has not requested another one.</p>}
      </article>)}
    </div>}
    <p className="admin-footnote">A supplier response records your account of events. It does not establish liability, guarantee a refund or determine the outcome of a dispute. RNX Operations reviews the information independently.</p>
  </section>;
}
