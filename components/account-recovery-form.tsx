'use client';

import { useState } from 'react';

type AccountType = 'customer' | 'supplier';

export function AccountRecoveryRequestForm({ accountType }: { accountType: AccountType }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/account/recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The recovery request could not be processed.');
      setMessage(result.message || 'If an eligible account uses this email address, a reset link has been requested.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A network error prevented the recovery request.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="form-card form-grid" onSubmit={submit}>
    <label className="full-field">Registered email address
      <input type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required />
    </label>
    <div className="full-field form-submit">
      <button className="button" type="submit" disabled={busy}>{busy ? 'Requesting link…' : 'Send password reset link'}</button>
      {message && <p className="form-status" role="status" aria-live="polite">{message}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
    <p className="fine-print full-field">For account privacy, the same confirmation is shown whether or not the email matches an eligible account. Reset links are one-time and expire after 60 minutes.</p>
  </form>;
}

export function AccountPasswordResetForm({ token, accountType }: { token: string; accountType: AccountType }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Use a password with at least 10 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The password confirmation does not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/account/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ accountType, token, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The password could not be changed.');
      setComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A network error prevented the password change.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <div className="notice"><strong>Reset link missing.</strong><p>Open the complete link from the recovery email or request a new one.</p></div>;
  if (complete) {
    const destination = accountType === 'supplier' ? '/supplier/login' : '/customer/login';
    return <div className="notice" role="status"><strong>Password changed.</strong><p>Your new password is active. Other devices may remain signed in until their existing sessions expire.</p><a className="button" href={destination}>Continue to sign in</a></div>;
  }

  return <form className="form-card form-grid" onSubmit={submit}>
    <label className="full-field">New password
      <input type="password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} maxLength={100} required />
      <span className="optional">Use at least 10 characters. Do not reuse a password from another service.</span>
    </label>
    <label className="full-field">Confirm new password
      <input type="password" name="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} maxLength={100} required />
    </label>
    {error && <p className="admin-error full-field" role="alert">{error}</p>}
    <div className="full-field form-submit"><button className="button" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Set new password'}</button></div>
    <p className="fine-print full-field">This link can be used once. If it has expired or was replaced by a newer link, return to the sign-in page and request another.</p>
  </form>;
}
