'use client';
import { useState } from 'react';

export function CustomerAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  async function resendVerification() {
    if (!pendingEmail) return;
    setResending(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/account/email-verification/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'customer', email: pendingEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'A new verification link could not be requested.');
      setNotice(result.message || 'Check your inbox for a verification link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A network error occurred.');
    } finally { setResending(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setNeedsVerification(false);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const email = String(data.email || '').trim().toLowerCase();
    try {
      const response = await fetch(`/api/customer/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.emailVerificationRequired) {
          setPendingEmail(email); setNeedsVerification(true);
        }
        throw new Error(result.error || 'Sign-in failed.');
      }
      if (mode === 'register' && result.requiresEmailVerification) {
        setPendingEmail(email); setNeedsVerification(true); setNotice(result.message || 'Check your email to confirm your account.');
        form.reset();
        return;
      }
      window.location.assign('/customer/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A network error occurred.');
    } finally { setBusy(false); }
  }

  return <form className="form-card customer-auth-form" onSubmit={submit}>
    {mode === 'register' && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    {mode === 'register' && <label>Phone / WhatsApp<input name="phone" autoComplete="tel" required minLength={7} maxLength={30} /></label>}
    <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 10 : 1} maxLength={100} />{mode === 'register' && <small>Use at least 10 characters. Do not reuse a password from another service.</small>}</label>
    <button className="button" type="submit" disabled={busy || resending}>{busy ? (mode === 'register' ? 'Creating account…' : 'Signing in…') : (mode === 'register' ? 'Create customer account' : 'Sign in')}</button>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p className="form-status" role="status">{notice}</p>}
    {needsVerification && pendingEmail && <div className="full-field">
      <button className="button button-secondary" type="button" onClick={resendVerification} disabled={resending}>{resending ? 'Requesting link…' : 'Resend email confirmation'}</button>
      <p className="fine-print">The confirmation link expires after 60 minutes. Check your spam folder as well.</p>
    </div>}
    {mode === 'register' && <p className="fine-print">You must confirm your email address before signing in. Your account is not active for customer portal access until confirmation is complete.</p>}
  </form>;
}
