'use client';
import { useEffect, useRef, useState } from 'react';

export function EmailVerificationForm() {
  const [status, setStatus] = useState('Confirming your email address…');
  const [kind, setKind] = useState<'pending' | 'success' | 'error'>('pending');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const query = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accountType = query.get('type');
    const token = query.get('token');
    // Remove the one-time bearer token from the visible address bar and browser history.
    window.history.replaceState(null, '', '/account/verify-email');
    if ((accountType !== 'customer' && accountType !== 'supplier') || !token) {
      setKind('error'); setStatus('This verification link is incomplete. Request a new link from the relevant sign-in page.');
      return;
    }
    fetch('/api/account/email-verification/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountType, token }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Email confirmation failed.');
      setKind('success'); setStatus(result.message || 'Your email address is confirmed.');
    }).catch((error) => {
      setKind('error'); setStatus(error instanceof Error ? error.message : 'Email confirmation failed.');
    });
  }, []);
  return <section className="form-card" aria-live="polite">
    <p className="eyebrow">EMAIL CONFIRMATION</p>
    <h2>{kind === 'success' ? 'Email confirmed' : kind === 'error' ? 'Confirmation not completed' : 'Confirming email'}</h2>
    <p className={kind === 'error' ? 'form-error' : 'form-status'}>{status}</p>
    {kind === 'success' && <p className="fine-print">Customers can now sign in. Supplier applicants remain subject to RNX business review; email confirmation alone is not supplier approval or a verified badge.</p>}
    {kind === 'error' && <p className="fine-print">Verification links expire after 60 minutes and can only be used once.</p>}
  </section>;
}
