'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function SaveListingButton({ listingId, isSignedIn }: { listingId: string; isSignedIn: boolean }) {
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(isSignedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    fetch(`/api/customer/saved-listings?listing_id=${encodeURIComponent(listingId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Saved status could not be checked.');
        if (active) setSaved(Boolean(data.saved));
      })
      .catch(() => {
        if (active) setError('Saved status is temporarily unavailable.');
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [isSignedIn, listingId]);

  async function toggleSaved() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/customer/saved-listings', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/customer/login'); return; }
      if (!response.ok) throw new Error(data.error || 'Your saved offers could not be updated.');
      setSaved(Boolean(data.saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your saved offers could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  if (!isSignedIn) {
    return <div className="save-listing-wrap"><Link className="button button-secondary save-listing-button" href="/customer/login">Sign in to save this offer</Link><small>Saved offers are available in your customer account.</small></div>;
  }

  return <div className="save-listing-wrap">
    <button className={`button ${saved ? 'button-secondary' : 'button-dark'} save-listing-button`} type="button" onClick={() => void toggleSaved()} disabled={checking || busy} aria-pressed={saved}>
      {checking ? 'Checking saved offers…' : busy ? 'Updating…' : saved ? 'Remove from saved offers' : 'Save this offer'}
    </button>
    {error && <small className="save-listing-error" role="alert">{error}</small>}
    {saved && <small role="status">Saved to your customer account.</small>}
  </div>;
}
