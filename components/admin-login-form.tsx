'use client';

import { useState } from 'react';

export function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || 'Sign-in failed. Check the configured credentials.');
        return;
      }
      window.location.assign(result.redirectTo || '/admin');
    } catch {
      setError('A network error prevented sign-in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="form-card admin-login-form" onSubmit={submit}>
    <label htmlFor="admin-email">Staff email <span className="muted">(leave blank for owner recovery sign-in)</span></label>
    <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={254} placeholder="name@company.com" />
    <label htmlFor="admin-password">Password</label>
    <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={1} maxLength={200} />
    <button className="button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
    {error && <p className="admin-error" role="alert">{error}</p>}
  </form>;
}
