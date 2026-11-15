'use client';
import { useState } from 'react';

export function SupplierClaimForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    try {
      const response = await fetch('/api/supplier/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, confirmPassword }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Account activation failed.');
      window.location.assign(result.redirectTo || '/supplier/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Account activation failed.'); }
    finally { setBusy(false); }
  }
  return <form className="form-card form-grid supplier-auth-form" onSubmit={submit}>
    <label className="full-field">Create password<input name="password" type="password" required minLength={10} maxLength={100} autoComplete="new-password" /></label>
    <label className="full-field">Confirm password<input name="confirmPassword" type="password" required minLength={10} maxLength={100} autoComplete="new-password" /></label>
    {error && <p className="form-error full-field" role="alert">{error}</p>}
    <div className="form-submit full-field"><button className="button" type="submit" disabled={busy || token.length < 40}>{busy ? 'Activating…' : 'Activate supplier portal'}</button><p className="form-status">This one-time link expires seven days after it is issued.</p></div>
  </form>;
}
