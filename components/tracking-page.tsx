'use client';

import { useCallback, useEffect, useState } from 'react';

type Message = { id: string; sender_role: string; sender_name: string; body: string; created_at: string };
type RequestRow = {
  id: string; request_type: string; category: string; state: string; city: string | null; details: string;
  referenced_listing_slug: string | null; referenced_listing_title: string | null; referenced_supplier_name: string | null;
  status: string; contact_release_status: string; created_at: string; last_activity_at: string | null;
};
type TrustCase = { id: string; case_reference: string; case_type: string; summary: string; status: string; public_resolution: string | null; created_at: string; updated_at: string; messages: Message[] };
type IntroducedSupplier = { id: string; introduced_at: string; supplier: { business_name: string; category: string } };

function stamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }); }
const caseTypes = [
  ['general_complaint','General complaint'], ['delivery_issue','Delivery issue'], ['product_quality','Product quality'],
  ['service_quality','Service quality'], ['payment_dispute','Payment dispute'], ['supplier_conduct','Supplier conduct'],
  ['suspected_fraud','Suspected fraud or misleading activity'], ['other','Other'],
];
const label = (value: string) => value.replaceAll('_', ' ');

export function TrackingPage({ token }: { token: string }) {
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cases, setCases] = useState<TrustCase[]>([]);
  const [caseReportingAvailable, setCaseReportingAvailable] = useState(true);
  const [introducedSuppliers, setIntroducedSuppliers] = useState<IntroducedSupplier[]>([]);
  const [offerId, setOfferId] = useState('');
  const [draft, setDraft] = useState('');
  const [caseType, setCaseType] = useState('general_complaint');
  const [caseSummary, setCaseSummary] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [requestedResolution, setRequestedResolution] = useState('');
  const [caseDrafts, setCaseDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [caseBusy, setCaseBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/track/${token}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tracking link unavailable.');
      setRequest(data.request);
      setMessages(data.messages || []);
      setCases(data.cases || []);
      setCaseReportingAvailable(data.caseReportingAvailable !== false);
      setIntroducedSuppliers(data.introducedSuppliers || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Tracking is temporarily unavailable.'); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function sendMessage() {
    if (draft.trim().length < 2) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/track/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Message failed.');
      setDraft(''); setNotice('Message sent to RNX Operations.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Message failed.'); }
    finally { setBusy(false); }
  }

  async function submitCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCaseBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/track/${token}/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseType, summary: caseSummary, description: caseDescription, requestedResolution, offerId: offerId || null }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your report could not be submitted.');
      setCaseSummary(''); setCaseDescription(''); setRequestedResolution(''); setOfferId('');
      setNotice(`Your report was submitted as ${data.case?.case_reference || 'a new case'}. Keep this tracking link to follow its progress.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Your report could not be submitted.'); }
    finally { setCaseBusy(false); }
  }

  async function sendCaseMessage(caseId: string) {
    const body = (caseDrafts[caseId] || '').trim();
    if (body.length < 2) return;
    setMessageBusy(caseId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/track/${token}/cases/${caseId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Case message could not be sent.');
      setCaseDrafts((current) => ({ ...current, [caseId]: '' })); setNotice('Case message sent.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Case message could not be sent.'); }
    finally { setMessageBusy(''); }
  }

  return <div className="tracking-shell">
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {!request && !error ? <div className="admin-empty">Loading request details…</div> : request && <>
      <article className="customer-request-card">
        <div className="customer-request-heading"><div><span className="eyebrow">PRIVATE REQUEST TRACKING</span><h2>{request.category}</h2><p>{[request.city, request.state].filter(Boolean).join(', ')} · Submitted {stamp(request.created_at)}</p></div><span className={`customer-status status-${request.status}`}>{request.status}</span></div>
        {request.referenced_listing_title && <p className="customer-request-reference">Published offer referenced: {request.referenced_listing_slug ? <a href={`/marketplace/listing/${encodeURIComponent(request.referenced_listing_slug)}`}>{request.referenced_listing_title}</a> : request.referenced_listing_title}{request.referenced_supplier_name ? ` · ${request.referenced_supplier_name}` : ''}. This records what you enquired about; it does not confirm current availability or price.</p>}
        <p className="customer-request-details">{request.details}</p>
        <div className="customer-request-meta"><span>Review status: {request.status}</span><span>Contact release: {request.contact_release_status}</span><span>Last activity: {stamp(request.last_activity_at || request.created_at)}</span></div>
      </article>

      <section className="tracking-thread">
        <h3>Raise a complaint or dispute</h3>
        <p className="fine-print">Use this form to report a problem connected to this sourcing request. RNX Operations manages the case and may request a factual response from the introduced supplier. Supplier responses shared with the case are visible here; internal RNX notes remain private. Do not include passwords, bank PINs, card details or identity-document numbers.</p>
        {!caseReportingAvailable ? <div className="admin-notice">The complaint and dispute system is temporarily unavailable during an upgrade. Use the general message thread below to contact RNX Operations.</div> : <form className="tracking-case-form" onSubmit={(event) => void submitCase(event)}>
          <label>Issue type<select value={caseType} onChange={(event) => setCaseType(event.target.value)}>{caseTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          {introducedSuppliers.length > 0 && <label>Supplier involved <span className="optional-label">Optional</span><select value={offerId} onChange={(event) => setOfferId(event.target.value)}><option value="">General request issue — no specific introduction</option>{introducedSuppliers.map((item) => <option key={item.id} value={item.id}>{item.supplier?.business_name || 'Introduced supplier'} · {item.supplier?.category || 'Supplier'}</option>)}</select></label>}
          <label>Short summary<input required minLength={5} maxLength={160} value={caseSummary} onChange={(event) => setCaseSummary(event.target.value)} placeholder="Describe the issue in one sentence" /></label>
          <label>What happened?<textarea required minLength={20} maxLength={4000} rows={5} value={caseDescription} onChange={(event) => setCaseDescription(event.target.value)} placeholder="Include relevant dates, agreed terms and what has happened so far." /></label>
          <label>What outcome are you requesting? <span className="optional-label">Optional</span><textarea maxLength={1200} rows={2} value={requestedResolution} onChange={(event) => setRequestedResolution(event.target.value)} placeholder="For example, an update, correction, replacement or refund review." /></label>
          <button className="button" type="submit" disabled={caseBusy || caseSummary.trim().length < 5 || caseDescription.trim().length < 20}>{caseBusy ? 'Submitting report…' : 'Submit complaint or dispute'}</button>
        </form>}
      </section>

      {caseReportingAvailable && <section className="tracking-thread">
        <h3>Your reported cases</h3>
        {cases.length ? cases.map((trustCase) => <article className="tracking-case-card" key={trustCase.id}>
          <div className="customer-request-heading"><div><span className="eyebrow">{trustCase.case_reference} · {label(trustCase.case_type)}</span><h4>{trustCase.summary}</h4><p>Submitted {stamp(trustCase.created_at)}</p></div><span className="customer-status">{label(trustCase.status)}</span></div>
          {trustCase.public_resolution && <div className="tracking-case-resolution"><strong>RNX resolution update</strong><p>{trustCase.public_resolution}</p></div>}
          <div className="tracking-case-messages">{trustCase.messages.map((message) => <div className={`customer-message ${message.sender_role === 'supplier' ? 'is-supplier' : message.sender_role === 'staff' ? 'is-operations' : 'is-customer'}`} key={message.id}><div><strong>{message.sender_name}</strong><small>{stamp(message.created_at)}</small></div><p>{message.body}</p></div>)}</div>
          {trustCase.status !== 'closed' ? <div className="customer-compose"><textarea rows={3} maxLength={3000} value={caseDrafts[trustCase.id] || ''} onChange={(event) => setCaseDrafts((current) => ({ ...current, [trustCase.id]: event.target.value }))} placeholder="Add a message about this case…" /><button className="button button-small" type="button" disabled={messageBusy === trustCase.id || (caseDrafts[trustCase.id] || '').trim().length < 2} onClick={() => void sendCaseMessage(trustCase.id)}>{messageBusy === trustCase.id ? 'Sending…' : 'Send case message'}</button></div> : <p className="fine-print">This case is closed. Contact RNX through your main request message thread if you need further assistance.</p>}
        </article>) : <p className="fine-print">You have not submitted a complaint or dispute for this request.</p>}
      </section>}

      <section className="customer-thread tracking-thread">
        <h3>General messages with RNX Operations</h3>
        {messages.length ? messages.map((message) => <div className={`customer-message ${message.sender_role === 'operations' ? 'is-operations' : 'is-customer'}`} key={message.id}><div><strong>{message.sender_name}</strong><small>{stamp(message.created_at)}</small></div><p>{message.body}</p></div>) : <p className="fine-print">No messages yet. Use this thread for general request questions not connected to a specific complaint or dispute.</p>}
        <div className="customer-compose"><textarea rows={4} maxLength={3000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a general message to RNX Operations…" /><button className="button" disabled={busy || draft.trim().length < 2} onClick={() => void sendMessage()}>{busy ? 'Sending…' : 'Send message'}</button></div>
      </section>
    </>}
  </div>;
}
