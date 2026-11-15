'use client';
import { useState } from 'react';

export function SupplierLoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch('/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
      window.location.assign(result.redirectTo || '/supplier/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  return <form className="form-card form-grid supplier-auth-form" onSubmit={submit}>
    <label className="full-field">Business email<input name="email" type="email" required autoComplete="username" maxLength={254} /></label>
    <label className="full-field">Password<input name="password" type="password" required autoComplete="current-password" maxLength={100} /></label>
    {error && <p className="form-error full-field" role="alert">{error}</p>}
    <div className="form-submit full-field"><button className="button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to supplier portal'}</button><p className="form-status">Access is available to approved supplier accounts only.</p></div>
  </form>;
}
