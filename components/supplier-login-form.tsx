'use client';
import { useState } from 'react';
export function SupplierLoginForm() {
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  async function resendVerification() {
    if (!pendingEmail) return;
    setResending(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/account/email-verification/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'supplier', email: pendingEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'A new verification link could not be requested.');
      setNotice(result.message || 'If the account needs confirmation, a new link has been requested.');
    } catch (err) { setError(err instanceof Error ? err.message : 'A network error occurred.'); }
    finally { setResending(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setNeedsVerification(false);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = String(values.email || '').trim().toLowerCase();
    try {
      const response = await fetch('/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.emailVerificationRequired) { setPendingEmail(email); setNeedsVerification(true); }
        throw new Error(result.error || 'Sign-in failed.');
      }
      window.location.assign(result.redirectTo || '/supplier/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  return <form className="form-card form-grid supplier-auth-form" onSubmit={submit}>
    <label className="full-field">Business email<input name="email" type="email" required autoComplete="username" maxLength={254} /></label>
    <label className="full-field">Password<input name="password" type="password" required autoComplete="current-password" maxLength={100} /></label>
    {error && <p className="form-error full-field" role="alert">{error}</p>}
    {notice && <p className="form-status full-field" role="status">{notice}</p>}
    {needsVerification && pendingEmail && <div className="full-field">
      <button className="button button-secondary" type="button" onClick={resendVerification} disabled={resending || busy}>{resending ? 'Requesting link…' : 'Resend email confirmation'}</button>
      <p className="fine-print">Confirm the business email before entering the supplier portal.</p>
    </div>}
    <div className="form-submit full-field"><button className="button" type="submit" disabled={busy || resending}>{busy ? 'Signing in…' : 'Sign in to supplier portal'}</button><p className="form-status">Access is available to approved supplier accounts whose business email has been confirmed.</p></div>
  </form>;
}
