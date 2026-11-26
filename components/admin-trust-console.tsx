'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type StaffOption = { id: string; full_name: string; email: string; role: string };
type Lead = { id: string; name: string; email: string | null; phone: string; category: string; state: string; city: string | null; status: string; created_at: string };
type CaseRow = { id: string; case_reference: string; lead_id: string; case_type: string; summary: string; description: string; requested_resolution: string | null; severity: string; status: string; public_resolution: string | null; assigned_staff_id: string | null; created_at: string; updated_at: string; first_response_sla_minutes: number; first_response_due_at: string | null; first_response_at: string | null; appeal_status?: string | null; appeal?: { status: string } | null; lead: Lead; supplier?: { business_name: string; status: string; category: string; state: string } | null; assigned?: StaffOption | null };
type Message = { id: string; sender_role: string; sender_name: string; visibility: string; body: string; created_at: string; sender_supplier_id?: string | null };
type EventRow = { id: string; actor_role: string; actor_email: string | null; event_type: string; from_status: string | null; to_status: string | null; created_at: string };
type EvidenceAttachment = { id: string; uploader_role: string; visibility: 'customer'|'internal'; file_name: string; mime_type: string; file_size_bytes: number; note: string | null; created_at: string };
type TrustCaseAppeal = { id: string; trust_case_id: string; status: 'submitted'|'accepted'|'not_upheld'; customer_reason: string; original_case_status: string; original_resolution_published_at: string; staff_response: string | null; reviewer_email: string | null; reviewed_at: string | null; created_at: string };
type Detail = { case: CaseRow; messages: Message[]; events: EventRow[]; attachments: EvidenceAttachment[]; appeal: TrustCaseAppeal | null };

const statuses = ['new','triaged','awaiting_customer','awaiting_supplier','under_review','resolved','closed'];
const severities = ['low','normal','high','critical'];
const statusLabel = (value: string) => value.replaceAll('_', ' ');
type ResponseSlaState = 'met'|'late'|'overdue'|'due_soon'|'on_track'|'unanswered'|'unconfigured';
function responseSlaState(row: Pick<CaseRow, 'first_response_due_at'|'first_response_at'|'status'>, now = Date.now()): ResponseSlaState {
  if (!row.first_response_due_at) return 'unconfigured';
  const due = new Date(row.first_response_due_at).getTime();
  if (!Number.isFinite(due)) return 'unconfigured';
  if (row.first_response_at) return new Date(row.first_response_at).getTime() <= due ? 'met' : 'late';
  if (['resolved','closed'].includes(row.status)) return 'unanswered';
  const remaining = due - now;
  if (remaining < 0) return 'overdue';
  if (remaining <= 60 * 60 * 1000) return 'due_soon';
  return 'on_track';
}
function responseSlaLabel(state: ResponseSlaState) {
  return ({ met: 'Response on time', late: 'Response late', overdue: 'Response overdue', due_soon: 'Due within 1 hour', on_track: 'Within response target', unanswered: 'Closed without public reply', unconfigured: 'SLA unavailable' } satisfies Record<ResponseSlaState, string>)[state];
}
function responseSlaTiming(row: Pick<CaseRow, 'first_response_due_at'|'first_response_at'|'status'>, now = Date.now()) {
  if (!row.first_response_due_at) return 'No response deadline recorded';
  const due = new Date(row.first_response_due_at).getTime();
  if (!Number.isFinite(due)) return 'No response deadline recorded';
  const actual = row.first_response_at ? new Date(row.first_response_at).getTime() : null;
  const delta = actual !== null ? actual - due : now - due;
  const absoluteMinutes = Math.max(0, Math.floor(Math.abs(delta) / 60000));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const duration = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  if (actual !== null) return delta <= 0 ? `Recorded ${duration} before the deadline` : `Recorded ${duration} after the deadline`;
  if (['resolved','closed'].includes(row.status)) return 'Case closed before a public staff reply was recorded';
  return delta > 0 ? `Overdue by ${duration}` : `Due in ${duration}`;
}
function stamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }); }
function fileSize(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }

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
  const [evidenceVisibility, setEvidenceVisibility] = useState<'internal'|'customer'>('internal');
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [appealResponse, setAppealResponse] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      setDetail(next); setStatus(next.case.status); setSeverity(next.case.severity); setAssignee(next.case.assigned_staff_id || ''); setResolution(next.case.public_resolution || ''); setAppealResponse('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Case details could not be loaded.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const slaCounts = useMemo(() => cases.reduce((counts, row) => {
    const state = responseSlaState(row, clock);
    if (state === 'overdue') counts.overdue += 1;
    if (state === 'due_soon') counts.dueSoon += 1;
    if (state === 'met') counts.met += 1;
    if (state === 'late' || state === 'unanswered') counts.missed += 1;
    return counts;
  }, { overdue: 0, dueSoon: 0, met: 0, missed: 0 }), [cases, clock]);

  const visibleCases = useMemo(() => cases.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'appeals') return row.appeal_status === 'submitted';
    if (filter === 'open') return !['resolved','closed'].includes(row.status) || row.appeal_status === 'submitted';
    if (filter === 'sla_overdue') return responseSlaState(row, clock) === 'overdue';
    if (filter === 'sla_due_soon') return responseSlaState(row, clock) === 'due_soon';
    if (filter === 'sla_late') return responseSlaState(row, clock) === 'late' || responseSlaState(row, clock) === 'unanswered';
    if (filter === 'sla_met') return responseSlaState(row, clock) === 'met';
    return row.status === filter;
  }).sort((a, b) => {
    const rank: Record<ResponseSlaState, number> = { overdue: 0, unanswered: 1, due_soon: 2, late: 3, on_track: 4, unconfigured: 5, met: 6 };
    return rank[responseSlaState(a, clock)] - rank[responseSlaState(b, clock)] || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }), [cases, filter, clock]);

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


  async function reviewAppeal(decision: 'accepted'|'not_upheld') {
    if (!detail?.appeal || !canWrite || appealResponse.trim().length < 10) return;
    setAppealBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/trust-cases/${detail.case.id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, staffResponse: appealResponse }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Appeal decision could not be saved.');
      setAppealResponse('');
      setNotice(decision === 'accepted' ? 'Appeal accepted. The case has been reopened for further review.' : 'Appeal not upheld. The original operational resolution remains in place.');
      await refresh(); await loadDetail(detail.case.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Appeal decision could not be saved.'); }
    finally { setAppealBusy(false); }
  }

  async function uploadEvidence(file: File | null) {
    if (!detail || !canWrite || !file) return;
    setEvidenceBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData(); form.set('file', file); form.set('visibility', evidenceVisibility);
      const response = await fetch(`/api/admin/trust-cases/${detail.case.id}/attachments`, { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Evidence upload failed.');
      setNotice(evidenceVisibility === 'internal' ? 'Internal evidence stored. Customers and suppliers cannot access it.' : 'Customer-visible evidence added to the case.');
      await loadDetail(detail.case.id); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Evidence upload failed.'); }
    finally { setEvidenceBusy(false); }
  }

  return <div className="admin-trust-console">
    <div className="supplier-dashboard-toolbar"><div><p className="eyebrow">CUSTOMER PROTECTION</p><h2>Complaints and disputes</h2><p>Private cases linked to customer request tracking. Move a case to Awaiting supplier to request a response from the introduced supplier. Internal staff notes remain hidden from customers and suppliers. Response SLA totals cover the latest 150 cases loaded here.</p></div><button className="button button-small" type="button" onClick={() => void refresh()} disabled={loading}>Refresh cases</button></div>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-trust-sla-summary" aria-label="First response service level summary">
      <div className="is-overdue"><span>Overdue</span><strong>{slaCounts.overdue}</strong></div>
      <div className="is-due-soon"><span>Due within 1 hour</span><strong>{slaCounts.dueSoon}</strong></div>
      <div className="is-met"><span>Responded on time</span><strong>{slaCounts.met}</strong></div>
      <div className="is-missed"><span>Late / unanswered</span><strong>{slaCounts.missed}</strong></div>
    </div>
    <div className="admin-trust-layout">
      <section className="supplier-panel admin-trust-list"><div className="supplier-section-heading"><div><p className="eyebrow">CASE QUEUE</p><h2>{visibleCases.length} cases</h2></div><label className="admin-trust-filter">Filter<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Open cases</option><option value="all">All cases</option><option value="appeals">Appeals awaiting review</option><option value="sla_overdue">Response SLA overdue</option><option value="sla_due_soon">Response due within 1 hour</option><option value="sla_late">Response late / unanswered</option><option value="sla_met">Response SLA met</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div>
        {loading ? <p className="admin-empty">Loading cases…</p> : visibleCases.length === 0 ? <p className="admin-empty">No cases match this filter.</p> : <div className="admin-trust-case-list">{visibleCases.map((row) => <button className={`admin-trust-case-item ${detail?.case.id === row.id ? 'is-selected' : ''}`} key={row.id} type="button" onClick={() => void loadDetail(row.id)}><span className="admin-trust-case-top"><strong>{row.case_reference}</strong><small className={`trust-severity severity-${row.severity}`}>{row.severity}</small></span><b>{row.summary}</b><span>{row.lead?.category || 'Customer request'} · {[row.lead?.city,row.lead?.state].filter(Boolean).join(', ')}</span>{row.supplier?.business_name && <span>Supplier: {row.supplier.business_name}</span>}<small>{statusLabel(row.status)} · Updated {stamp(row.updated_at)}</small><small className={`admin-trust-sla-badge sla-${responseSlaState(row, clock)}`}>{responseSlaLabel(responseSlaState(row, clock))} · {responseSlaTiming(row, clock)}</small>{row.appeal_status === 'submitted' && <small className="admin-trust-appeal-badge">CUSTOMER APPEAL AWAITING REVIEW</small>}</button>)}</div>}
      </section>
      <section className="supplier-panel admin-trust-detail"><div className="supplier-section-heading"><div><p className="eyebrow">CASE WORKSPACE</p><h2>{detail?.case.case_reference || 'Select a case'}</h2></div>{detail && <span className="customer-status">{statusLabel(detail.case.status)}</span>}</div>
        {!detail ? <p className="admin-empty">Select a case to review the request context, handling history and customer messages.</p> : <>
          <div className="admin-trust-customer"><strong>{detail.case.lead?.name || 'Customer'}</strong><span>{detail.case.lead?.phone || 'No phone'} · {detail.case.lead?.email || 'No email'}</span><small>{detail.case.lead?.category} · {[detail.case.lead?.city,detail.case.lead?.state].filter(Boolean).join(', ')} · Request {detail.case.lead_id}</small>{detail.case.supplier?.business_name && <small>Introduced supplier: {detail.case.supplier.business_name} · Current application status: {detail.case.supplier.status}</small>}</div>
          <div className="admin-trust-description"><span className="eyebrow">CUSTOMER REPORT · {detail.case.case_type.replaceAll('_',' ')}</span><h3>{detail.case.summary}</h3><p>{detail.case.description}</p>{detail.case.requested_resolution && <p><strong>Requested outcome:</strong> {detail.case.requested_resolution}</p>}</div>
          <section className={`admin-trust-sla-detail sla-${responseSlaState(detail.case, clock)}`}><div><p className="eyebrow">SLA MONITOR</p><strong>{responseSlaLabel(responseSlaState(detail.case, clock))}</strong><span>{responseSlaTiming(detail.case, clock)}</span></div><dl><div><dt>First-response target</dt><dd>{detail.case.first_response_sla_minutes >= 60 ? `${detail.case.first_response_sla_minutes / 60} hours` : `${detail.case.first_response_sla_minutes} minutes`} from case submission</dd></div><div><dt>Response deadline</dt><dd>{detail.case.first_response_due_at ? stamp(detail.case.first_response_due_at) : 'Not recorded'}</dd></div><div><dt>First public staff reply</dt><dd>{detail.case.first_response_at ? stamp(detail.case.first_response_at) : 'Not recorded'}</dd></div></dl><small>Elapsed-time target. Only the first customer-visible RNX staff reply counts. Internal notes, customer messages and supplier responses do not satisfy this target. This is an operational monitoring measure, not a guarantee that a case will be resolved by the deadline.</small></section>
          <div className="admin-trust-controls"><label>Status<select disabled={!canWrite} value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label>Severity<select disabled={!canWrite} value={severity} onChange={(event) => setSeverity(event.target.value)}>{severities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Assigned staff<select disabled={!canWrite} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{staff.map((row) => <option key={row.id} value={row.id}>{row.full_name} · {row.role.replaceAll('_',' ')}</option>)}</select></label></div>
          <label className="admin-trust-resolution">Customer-visible resolution summary<textarea disabled={!canWrite} rows={3} maxLength={1800} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Record an accurate summary of the agreed outcome. This becomes visible to the customer." /></label>
          {canWrite && <button className="button button-small" type="button" disabled={busy} onClick={() => void saveCase()}>{busy ? 'Saving…' : 'Save case changes'}</button>}
          {detail.appeal && <section className="admin-trust-appeal" aria-label="Customer resolution appeal">
            <div className="supplier-section-heading"><div><p className="eyebrow">CUSTOMER APPEAL</p><h3>Resolution review request</h3><small>Submitted {stamp(detail.appeal.created_at)} · Original case status: {statusLabel(detail.appeal.original_case_status)}</small></div><span className="customer-status">{statusLabel(detail.appeal.status)}</span></div>
            <div className="admin-trust-appeal-reason"><strong>Customer explanation</strong><p>{detail.appeal.customer_reason}</p></div>
            {detail.appeal.status === 'submitted' ? <div className="admin-trust-appeal-review"><label>Customer-visible decision response<textarea disabled={!canWrite} rows={4} maxLength={1800} minLength={10} value={appealResponse} onChange={(event) => setAppealResponse(event.target.value)} placeholder="Explain what RNX reviewed, what was considered and why the appeal is accepted or not upheld." /></label><small>10–1,800 characters. This response is shared with the customer and recorded in the case history.</small>{canWrite && <div><button className="button button-small" type="button" disabled={appealBusy || appealResponse.trim().length < 10} onClick={() => void reviewAppeal('accepted')}>{appealBusy ? 'Saving decision…' : 'Accept and reopen case'}</button><button className="button button-small button-secondary" type="button" disabled={appealBusy || appealResponse.trim().length < 10} onClick={() => void reviewAppeal('not_upheld')}>Do not uphold appeal</button></div>}</div> : <div className="admin-trust-appeal-result"><strong>{detail.appeal.status === 'accepted' ? 'Appeal accepted — case reopened' : 'Appeal not upheld'}</strong><p>{detail.appeal.staff_response}</p><small>{detail.appeal.reviewer_email || 'RNX Operations'} · {stamp(detail.appeal.reviewed_at || detail.appeal.created_at)}</small></div>}
          </section>}
          <div className="admin-trust-messages"><h3>Case conversation and internal notes</h3>{detail.messages.map((row) => <article className={`customer-message ${row.visibility === 'internal' ? 'is-internal' : row.sender_role === 'supplier' ? 'is-supplier' : row.sender_role === 'staff' ? 'is-operations' : 'is-customer'}`} key={row.id}><div><strong>{row.sender_name} · {row.visibility === 'internal' ? 'INTERNAL NOTE' : row.sender_role === 'supplier' ? 'SUPPLIER RESPONSE' : row.sender_role === 'staff' ? 'RNX OPERATIONS' : 'CUSTOMER MESSAGE'}</strong><small>{stamp(row.created_at)}</small></div><p>{row.body}</p></article>)}{detail.messages.length === 0 && <p className="fine-print">No case messages yet.</p>}
            {canWrite && <div className="customer-compose"><label>Message visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as 'internal'|'customer')}><option value="internal">Internal note — staff only</option><option value="customer">Customer-visible reply</option></select></label><textarea rows={3} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a case update…" /><button className="button button-small" type="button" disabled={busy || message.trim().length < 2 || (detail.case.status === 'closed' && visibility === 'customer')} onClick={() => void sendMessage()}>{busy ? 'Saving…' : 'Add case message'}</button></div>}
          </div>
          <div className="admin-trust-evidence"><div className="trust-evidence-heading"><div><h3>Evidence vault</h3><small>Private files linked to this case. Internal evidence is not visible to the customer or supplier.</small></div><span>{detail.attachments?.length || 0}/20</span></div>
            {(detail.attachments || []).length ? <div className="trust-evidence-list">{detail.attachments.map((attachment) => <article key={attachment.id}><div><strong>{attachment.file_name}</strong><small>{fileSize(attachment.file_size_bytes)} · {attachment.uploader_role} · {stamp(attachment.created_at)}</small><small className={attachment.visibility === 'internal' ? 'trust-evidence-internal' : 'trust-evidence-customer'}>{attachment.visibility === 'internal' ? 'INTERNAL — STAFF ONLY' : 'CUSTOMER AND ASSIGNED SUPPLIER'}</small>{attachment.note && <small>{attachment.note}</small>}</div><a className="button button-small button-secondary" href={`/api/admin/trust-cases/${detail.case.id}/attachments/${attachment.id}`} target="_blank" rel="noreferrer">Open file</a></article>)}</div> : <p className="fine-print">No evidence files have been uploaded.</p>}
            {canWrite && (detail.attachments?.length || 0) < 20 && <div className="trust-evidence-admin-upload"><label>Evidence visibility<select value={evidenceVisibility} onChange={(event) => setEvidenceVisibility(event.target.value as 'internal'|'customer')}><option value="internal">Internal — staff only</option><option value="customer">Customer and supplier visible</option></select></label><label className="trust-evidence-upload">{evidenceBusy ? 'Uploading evidence…' : 'Add evidence file'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={evidenceBusy} onChange={(event) => { const file = event.target.files?.[0] || null; void uploadEvidence(file); event.currentTarget.value = ''; }} /><small>PDF, JPEG, PNG or WebP · maximum 4 MB per file.</small></label></div>}
          </div>
          <div className="admin-trust-events"><h3>Handling history</h3>{detail.events.map((event) => <p key={event.id}><strong>{event.event_type.replaceAll('_',' ')}</strong><span>{event.actor_email || event.actor_role} · {stamp(event.created_at)}</span>{event.from_status && event.to_status && <small>{statusLabel(event.from_status)} → {statusLabel(event.to_status)}</small>}</p>)}</div>
          <p className="admin-footnote">Case records preserve the customer's report and handling history. Investigate evidence independently. Do not state that a supplier committed fraud, breached a contract or is legally liable unless that conclusion is properly established. RNX case closure is an operational record, not a court or regulatory finding.</p>
        </>}
      </section>
    </div>
  </div>;
}
