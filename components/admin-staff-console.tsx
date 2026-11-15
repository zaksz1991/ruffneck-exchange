'use client';

import { useCallback, useEffect, useState } from 'react';

type Role = 'owner' | 'operations_admin' | 'finance' | 'support' | 'analyst';
type StaffRow = { id: string; email: string; full_name: string; role: Role; status: 'active' | 'suspended'; last_login_at: string | null; created_at: string };
type InviteRow = { id: string; email: string; role: Role; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };
type ActivityRow = { id: string; actor_email: string; actor_role: string; event_type: string; entity_type: string | null; entity_id: string | null; details: Record<string, unknown>; created_at: string };
type Payload = { staff: StaffRow[]; invitations: InviteRow[]; activity: ActivityRow[] };
const roles: Role[] = ['owner','operations_admin','finance','support','analyst'];
const roleLabels: Record<Role, string> = { owner: 'Owner', operations_admin: 'Operations administrator', finance: 'Finance', support: 'Customer support', analyst: 'Analytics' };
function stamp(value: string | null) { return value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'; }

export function AdminStaffConsole() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('support');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/staff', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Staff data could not be loaded.');
      setData(result as Payload);
    } catch (err) { setError(err instanceof Error ? err.message : 'Staff data could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setInviteUrl('');
    try {
      const response = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Invitation could not be created.');
      setInviteUrl(result.invitationUrl || '');
      setNotice(`Invitation created. It expires ${stamp(result.expiresAt)}.`);
      setEmail(''); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Invitation could not be created.'); }
    finally { setBusy(false); }
  }

  async function changeStaff(row: StaffRow, patch: { role?: Role; status?: 'active' | 'suspended' }) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/staff/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Staff access could not be changed.');
      setNotice(`Updated access for ${row.email}.`); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Staff access could not be changed.'); }
    finally { setBusy(false); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setNotice('Invitation link copied. Share it privately with the intended staff member.'); }
    catch { setError('Copy failed. Select and copy the invitation link manually.'); }
  }

  return <section className="admin-staff-console">
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h2>Invite a staff member</h2></div></div>
      <p className="muted">Invitations are single-use and expire after 48 hours. The invitation link is displayed once. Share it privately; do not post it in a public channel.</p>
      <form className="admin-staff-invite-form" onSubmit={createInvite}>
        <label>Staff email<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@ruffneck..." /></label>
        <label>Role<select value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}</select></label>
        <button className="button" disabled={busy}>{busy ? 'Creating…' : 'Create private invitation'}</button>
      </form>
      {inviteUrl && <div className="admin-link-box"><strong>Single-use staff invitation</strong><p>Copy this link now and send it only to the invited person. The raw token will not be shown again after leaving this page.</p><div><input readOnly value={inviteUrl} aria-label="Staff invitation link" /><button className="button button-small" type="button" onClick={() => void copyInvite()}>Copy link</button></div></div>}
      {notice && <p className="admin-state-good" role="status">{notice}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="eyebrow">TEAM DIRECTORY</p><h2>Staff accounts</h2></div><span>{data?.staff.length ?? 0} accounts</span></div>
      {loading ? <p className="admin-empty">Loading staff accounts…</p> : data?.staff.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Access control</th></tr></thead><tbody>{data.staff.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong><small>{row.email}</small><small>Added {stamp(row.created_at)}</small></td><td><select aria-label={`Role for ${row.email}`} value={row.role} disabled={busy} onChange={(event) => void changeStaff(row, { role: event.target.value as Role })}>{roles.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}</select></td><td><span className={row.status === 'active' ? 'admin-state-good' : 'admin-state-bad'}>{row.status}</span></td><td>{stamp(row.last_login_at)}</td><td><button className="admin-mini-action" type="button" disabled={busy} onClick={() => void changeStaff(row, { status: row.status === 'active' ? 'suspended' : 'active' })}>{row.status === 'active' ? 'Suspend access' : 'Restore access'}</button></td></tr>)}</tbody></table></div> : <p className="admin-empty">No staff accounts have accepted invitations yet. The existing environment-password owner login remains available as recovery access.</p>}
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="eyebrow">INVITATION HISTORY</p><h2>Recent invitations</h2></div></div>
      {data?.invitations.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Created</th><th>Expires</th><th>Status</th></tr></thead><tbody>{data.invitations.map((row) => <tr key={row.id}><td>{row.email}</td><td>{roleLabels[row.role]}</td><td>{stamp(row.created_at)}</td><td>{stamp(row.expires_at)}</td><td>{row.accepted_at ? 'Accepted' : row.revoked_at ? 'Revoked' : new Date(row.expires_at).getTime() < Date.now() ? 'Expired' : 'Pending'}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No invitations recorded.</p>}
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h2>Recent staff activity</h2></div><span>{data?.activity.length ?? 0} events</span></div>
      {data?.activity.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Staff</th><th>Event</th><th>Record</th></tr></thead><tbody>{data.activity.map((row) => <tr key={row.id}><td>{stamp(row.created_at)}</td><td><strong>{row.actor_email}</strong><small>{row.actor_role}</small></td><td>{row.event_type.replaceAll('_', ' ')}</td><td>{row.entity_type || '—'}{row.entity_id ? <small>{row.entity_id}</small> : null}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No staff activity has been recorded.</p>}
    </section>
  </section>;
}
