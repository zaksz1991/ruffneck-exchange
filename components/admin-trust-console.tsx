'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type StaffOption = { id: string; full_name: string; email: string; role: string };
type Lead = { id: string; name: string; email: string | null; phone: string; category: string; state: string; city: string | null; status: string; created_at: string };
type CaseRow = { id: string; case_reference: string; lead_id: string; case_type: string; summary: string; description: string; requested_resolution: string | null; severity: string; status: string; public_resolution: string | null; assigned_staff_id: string | null; created_at: string; updated_at: string; lead: Lead; supplier?: { business_name: string; status: string; category: string; state: string } | null; assigned?: StaffOption | null };
type Message = { id: string; sender_role: string; sender_name: string; visibility: string; body: string; created_at: string };
type EventRow = { id: string; actor_role: string; actor_email: string | null; event_type: string; from_status: string | null; to_status: string | null; created_at: string };
type Detail = { case: CaseRow; messages: Message[]; events: EventRow[] };

const statuses = ['new','triaged','awaiting_customer','awaiting_supplier','under_review','resolved','closed'];
const severities = ['low','normal','high','critical'];
const statusLabel = (value: string) => value.replaceAll('_', ' ');
function stamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }); }

export function AdminTrustConsole({ canWrite }: { canWrite: boolean }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState('open');
  const [status, setStatus] = useState('new');
  const [severity, setSeverity] = useState('normal');
  const [assignee, setAssignee] = useState('');
  const [resolution, setResolution] = useState('');
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'internal'|'customer'>('internal');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/trust-cases', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(data.error || 'Trust cases could not be loaded.');
      setCases((data.cases || []) as CaseRow[]);
      setStaff((data.staff || []) as StaffOption[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Trust cases could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setError('');
    try {
      const response = await fetch(`/api/admin/trust-cases/${id}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Case details could not be loaded.');
      const next = data as Detail;
      setDetail(next); setStatus(next.case.status); setSeverity(next.case.severity); setAssignee(next.case.assigned_staff_id || ''); setResolution(next.case.public_resolution || '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Case details could not be loaded.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleCases = useMemo(() => cases.filter((row) => filter === 'all' || (filter === 'open' ? !['resolved','closed'].includes(row.status) : row.status === filter)), [cases, filter]);

  async function saveCase() {
    if (!detail || !canWrite) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/trust-cases/${detail.case.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, severity, assignedStaffId: assignee || null, publicResolution: resolution }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Case update failed.');
      setNotice(`${detail.case.case_reference} updated.`); await refresh(); await loadDetail(detail.case.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Case update failed.'); }
    finally { setBusy(false); }
  }

  async function sendMessage() {
    if (!detail || !canWrite || message.trim().length < 2) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/trust-cases/${detail.case.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: message, visibility }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Message was not saved.');
      setMessage(''); setNotice(visibility === 'internal' ? 'Internal note saved. The customer cannot see it.' : 'Customer-visible update saved.');
      await loadDetail(detail.case.id); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Message was not saved.'); }
    finally { setBusy(false); }
  }

  return <div className="admin-trust-console">
    <div className="supplier-dashboard-toolbar"><div><p className="eyebrow">CUSTOMER PROTECTION</p><h2>Complaints and disputes</h2><p>Private cases linked to customer request tracking. Internal notes remain hidden from customers.</p></div><button className="button button-small" type="button" onClick={() => void refresh()} disabled={loading}>Refresh cases</button></div>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-trust-layout">
      <section className="supplier-panel admin-trust-list"><div className="supplier-section-heading"><div><p className="eyebrow">CASE QUEUE</p><h2>{visibleCases.length} cases</h2></div><label className="admin-trust-filter">Filter<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Open cases</option><option value="all">All cases</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div>
        {loading ? <p className="admin-empty">Loading cases…</p> : visibleCases.length === 0 ? <p className="admin-empty">No cases match this filter.</p> : <div className="admin-trust-case-list">{visibleCases.map((row) => <button className={`admin-trust-case-item ${detail?.case.id === row.id ? 'is-selected' : ''}`} key={row.id} type="button" onClick={() => void loadDetail(row.id)}><span className="admin-trust-case-top"><strong>{row.case_reference}</strong><small className={`trust-severity severity-${row.severity}`}>{row.severity}</small></span><b>{row.summary}</b><span>{row.lead?.category || 'Customer request'} · {[row.lead?.city,row.lead?.state].filter(Boolean).join(', ')}</span>{row.supplier?.business_name && <span>Supplier: {row.supplier.business_name}</span>}<small>{statusLabel(row.status)} · Updated {stamp(row.updated_at)}</small></button>)}</div>}
      </section>
      <section className="supplier-panel admin-trust-detail"><div className="supplier-section-heading"><div><p className="eyebrow">CASE WORKSPACE</p><h2>{detail?.case.case_reference || 'Select a case'}</h2></div>{detail && <span className="customer-status">{statusLabel(detail.case.status)}</span>}</div>
        {!detail ? <p className="admin-empty">Select a case to review the request context, handling history and customer messages.</p> : <>
          <div className="admin-trust-customer"><strong>{detail.case.lead?.name || 'Customer'}</strong><span>{detail.case.lead?.phone || 'No phone'} · {detail.case.lead?.email || 'No email'}</span><small>{detail.case.lead?.category} · {[detail.case.lead?.city,detail.case.lead?.state].filter(Boolean).join(', ')} · Request {detail.case.lead_id}</small>{detail.case.supplier?.business_name && <small>Introduced supplier: {detail.case.supplier.business_name} · Current application status: {detail.case.supplier.status}</small>}</div>
          <div className="admin-trust-description"><span className="eyebrow">CUSTOMER REPORT · {detail.case.case_type.replaceAll('_',' ')}</span><h3>{detail.case.summary}</h3><p>{detail.case.description}</p>{detail.case.requested_resolution && <p><strong>Requested outcome:</strong> {detail.case.requested_resolution}</p>}</div>
          <div className="admin-trust-controls"><label>Status<select disabled={!canWrite} value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label>Severity<select disabled={!canWrite} value={severity} onChange={(event) => setSeverity(event.target.value)}>{severities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Assigned staff<select disabled={!canWrite} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{staff.map((row) => <option key={row.id} value={row.id}>{row.full_name} · {row.role.replaceAll('_',' ')}</option>)}</select></label></div>
          <label className="admin-trust-resolution">Customer-visible resolution summary<textarea disabled={!canWrite} rows={3} maxLength={1800} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Record an accurate summary of the agreed outcome. This becomes visible to the customer." /></label>
          {canWrite && <button className="button button-small" type="button" disabled={busy} onClick={() => void saveCase()}>{busy ? 'Saving…' : 'Save case changes'}</button>}
          <div className="admin-trust-messages"><h3>Case conversation and internal notes</h3>{detail.messages.map((row) => <article className={`customer-message ${row.visibility === 'internal' ? 'is-internal' : row.sender_role === 'staff' ? 'is-operations' : 'is-customer'}`} key={row.id}><div><strong>{row.sender_name} · {row.visibility === 'internal' ? 'INTERNAL NOTE' : 'CUSTOMER VISIBLE'}</strong><small>{stamp(row.created_at)}</small></div><p>{row.body}</p></article>)}{detail.messages.length === 0 && <p className="fine-print">No case messages yet.</p>}
            {canWrite && <div className="customer-compose"><label>Message visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as 'internal'|'customer')}><option value="internal">Internal note — staff only</option><option value="customer">Customer-visible reply</option></select></label><textarea rows={3} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a case update…" /><button className="button button-small" type="button" disabled={busy || message.trim().length < 2 || (detail.case.status === 'closed' && visibility === 'customer')} onClick={() => void sendMessage()}>{busy ? 'Saving…' : 'Add case message'}</button></div>}
          </div>
          <div className="admin-trust-events"><h3>Handling history</h3>{detail.events.map((event) => <p key={event.id}><strong>{event.event_type.replaceAll('_',' ')}</strong><span>{event.actor_email || event.actor_role} · {stamp(event.created_at)}</span>{event.from_status && event.to_status && <small>{statusLabel(event.from_status)} → {statusLabel(event.to_status)}</small>}</p>)}</div>
          <p className="admin-footnote">Case records preserve the customer's report and handling history. Investigate evidence independently. Do not state that a supplier committed fraud, breached a contract or is legally liable unless that conclusion is properly established. RNX case closure is an operational record, not a court or regulatory finding.</p>
        </>}
      </section>
    </div>
  </div>;
}
