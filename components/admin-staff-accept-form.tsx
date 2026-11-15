'use client';

import { useState } from 'react';

export function AdminStaffAcceptForm({ token }: { token: string }) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const validToken = /^[a-f0-9]{64}$/i.test(token);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!validToken) { setError('The invitation link is incomplete or invalid. Request a new invitation from the RNX owner.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/staff/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, fullName, password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The invitation could not be accepted.');
      window.location.assign(result.redirectTo || '/admin');
    } catch (err) { setError(err instanceof Error ? err.message : 'The invitation could not be accepted.'); }
    finally { setBusy(false); }
  }

  return <form className="form-card admin-login-form" onSubmit={submit}>
    {!validToken && <p className="admin-error" role="alert">Invalid or missing invitation token.</p>}
    <label htmlFor="staff-full-name">Full name</label>
    <input id="staff-full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} required />
    <label htmlFor="staff-password">Create password</label>
    <input id="staff-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required />
    <small>Use at least 12 characters, including upper-case, lower-case and numeric characters.</small>
    <label htmlFor="staff-password-confirm">Confirm password</label>
    <input id="staff-password-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} required />
    <button className="button" type="submit" disabled={busy || !validToken}>{busy ? 'Activating account…' : 'Activate staff account'}</button>
    {error && <p className="admin-error" role="alert">{error}</p>}
  </form>;
}
