"use client";

import { useState } from 'react';

type Match = {
  supplierId: string;
  businessName: string;
  category: string;
  state: string;
  score: number;
  reasons: string[];
  listings: Array<{ title: string; listingType: string; category: string; state: string; city: string | null }>;
};

export function AdminMatchAssistant({ leadId, selectedSupplierId, onSelectSupplier }: {
  leadId: string;
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function findMatches() {
    if (!leadId) return;
    setLoading(true); setError(''); setNote(''); setMatches([]); setLoadedFor('');
    try {
      const response = await fetch('/api/admin/matches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }), cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Could not find supplier matches.');
      setMatches(Array.isArray(result.matches) ? result.matches : []);
      setNote(result.note || '');
      setLoadedFor(leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find supplier matches.');
    } finally { setLoading(false); }
  }

  return <div className="admin-match-assistant">
    <div className="admin-match-assistant-head">
      <div><strong>Find suitable approved suppliers</strong><p>Ranks suppliers using category, approved listings and location. It does not contact suppliers automatically.</p></div>
      <button className="button button-small button-dark" type="button" onClick={() => void findMatches()} disabled={!leadId || loading}>{loading ? 'Matching…' : 'Find supplier matches'}</button>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loadedFor === leadId && matches.length === 0 && <p className="admin-empty">No sufficiently relevant approved suppliers were found. Review the category, broaden the location manually, or continue supplier sourcing.</p>}
    {loadedFor === leadId && matches.length > 0 && <div className="admin-match-list">
      {matches.map((match) => <article className={`admin-match-card${selectedSupplierId === match.supplierId ? ' is-selected' : ''}`} key={match.supplierId}>
        <div className="admin-match-card-top"><div><strong>{match.businessName}</strong><small>{match.category} · {match.state}</small></div><span className="admin-match-score" aria-label={`Internal match score ${match.score} out of 100`}>{match.score}/100</span></div>
        <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        {match.listings.length > 0 && <div className="admin-match-listings"><small>Approved catalogue evidence</small>{match.listings.map((listing) => <p key={`${match.supplierId}-${listing.title}`}>{listing.title} — {listing.category} · {listing.listingType} · {[listing.city, listing.state].filter(Boolean).join(', ')}</p>)}</div>}
        <button type="button" className="button button-small" onClick={() => onSelectSupplier(match.supplierId)}>{selectedSupplierId === match.supplierId ? 'Selected supplier' : 'Use this supplier'}</button>
      </article>)}
    </div>}
    {loadedFor === leadId && note && <p className="admin-footnote">{note}</p>}
    <p className="admin-footnote">The score is an internal sorting aid, not a supplier quality rating. Confirm capability, stock, pricing, legal requirements, service coverage and availability directly before presenting an opportunity.</p>
  </div>;
}
