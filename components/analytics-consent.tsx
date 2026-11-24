'use client';

import { useEffect, useState } from 'react';
import { clearStoredAttribution, saveFirstTouchAttribution } from '@/lib/analytics-client';

type Choice = 'accepted' | 'rejected' | null;

export function AnalyticsConsent() {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rnx_analytics_consent_v1');
      if (stored === 'accepted' || stored === 'rejected') {
        setChoice(stored);
        if (stored === 'accepted') saveFirstTouchAttribution();
      } else setOpen(true);
    } catch { setOpen(true); }
    setReady(true);
  }, []);

  async function decide(next: Exclude<Choice, null>) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/analytics/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your privacy preference could not be saved.');
      try { localStorage.setItem('rnx_analytics_consent_v1', next); } catch { /* cookie is authoritative on the server */ }
      setChoice(next);
      if (next === 'accepted') saveFirstTouchAttribution();
      else clearStoredAttribution();
      window.dispatchEvent(new Event('rnx-analytics-consent-changed'));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your preference could not be saved.');
    } finally { setBusy(false); }
  }

  if (!ready) return null;
  return <>
    <button type="button" className="privacy-settings-trigger" onClick={() => setOpen((value) => !value)}>Privacy settings</button>
    {open && <section className="analytics-consent-panel" role="dialog" aria-modal="false" aria-labelledby="analytics-consent-title">
      <div className="analytics-consent-copy">
        <p className="eyebrow">YOUR PRIVACY</p>
        <h2 id="analytics-consent-title">Optional analytics</h2>
        <p>RuffNeck Exchange can record limited campaign attribution when a customer request or business application is submitted, and aggregate detail-view events for published marketplace listings. Listing-view records contain the listing and supplier references and event time; they do not include customer account or contact fields. Supplier reports show aggregate counts, not customer identities. These optional analytics run only after you accept. Referrer URLs are reduced to the referring website name; personal details and full query strings are not collected.</p>
        <p>Essential functions do not depend on analytics consent. You can change this choice later from Privacy settings.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
      </div>
      <div className="analytics-consent-actions">
        <button className="button button-small" type="button" disabled={busy} onClick={() => void decide('accepted')}>{busy ? 'Saving…' : 'Allow optional analytics'}</button>
        <button className="button button-small button-dark" type="button" disabled={busy} onClick={() => void decide('rejected')}>Reject optional analytics</button>
        {choice && <button type="button" className="text-button" onClick={() => setOpen(false)}>Close</button>}
      </div>
    </section>}
  </>;
}
