'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Dispute = { id: string; lead_offer_id: string; customer_outcome: string; supplier_outcome: string; updated_at: string; customer: { name: string; email: string } | { name: string; email: string }[]; supplier: { business_name: string } | { business_name: string }[]; offer: { lead: { id: string; category: string; state: string; city: string | null } | { id: string; category: string; state: string; city: string | null }[] } | { lead: { id: string; category: string; state: string; city: string | null } | { id: string; category: string; state: string; city: string | null }[] }[] };
type Review = {
  id: string;
  lead_offer_id: string;
  rating: number;
  title: string;
  body: string;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'hidden';
  created_at: string;
  supplier_response: string | null;
  customer: { name: string; email: string } | { name: string; email: string }[];
  supplier: { business_name: string; public_slug: string } | { business_name: string; public_slug: string }[];
  outcome: { status: string; customer_outcome: string; supplier_outcome: string; completed_at: string } | { status: string; customer_outcome: string; supplier_outcome: string; completed_at: string }[];
};

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function stamp(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }); }

export function AdminReviewConsole({ canWrite }: { canWrite: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/reviews', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Reviews could not be loaded.');
      setReviews(result.reviews || []);
      setDisputes(result.disputes || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reviews could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => reviews.filter((review) => filter === 'all' || review.moderation_status === filter), [reviews, filter]);

  async function moderate(reviewId: string, moderationStatus: 'approved' | 'rejected' | 'hidden') {
    setBusy(reviewId); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId, moderationStatus }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Moderation decision could not be saved.');
      setNotice(`Review ${moderationStatus}.`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Moderation decision could not be saved.'); }
    finally { setBusy(''); }
  }

  return <section className="admin-review-console supplier-panel">
    <div className="supplier-section-heading"><div><p className="eyebrow">REVIEW MODERATION</p><h2>Customer feedback</h2><p>Only reviews tied to introductions with dual transaction-completion confirmation are eligible for publication.</p></div><button className="button button-small button-dark" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-review-toolbar"><span>{visible.length} reviews</span><label>Filter<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Awaiting moderation</option><option value="approved">Published</option><option value="rejected">Rejected</option><option value="hidden">Hidden</option><option value="all">All reviews</option></select></label></div>
    {disputes.length > 0 && <section className="admin-review-disputes"><div><p className="eyebrow">OPERATIONS FOLLOW-UP</p><h3>{disputes.length} disputed transaction outcome{disputes.length === 1 ? '' : 's'}</h3><p>Customer and supplier submitted different completion outcomes. These introductions are excluded from verified reviews until the discrepancy is handled.</p></div><div className="admin-review-list">{disputes.map((row) => { const supplier = one(row.supplier); const customer = one(row.customer); const offer = one(row.offer); const lead = one(offer?.lead); return <article className="admin-review-card" key={row.id}><div className="admin-review-card-heading"><div><strong>{supplier?.business_name || 'Supplier'} · {customer?.name || 'Customer'}</strong><span>{lead?.category || 'Customer request'} · {[lead?.city, lead?.state].filter(Boolean).join(', ')}</span></div><span className="admin-state-bad">disputed</span></div><div className="admin-review-proof"><span>Customer: {row.customer_outcome.replaceAll('_', ' ')}</span><span>Supplier: {row.supplier_outcome.replaceAll('_', ' ')}</span><span>Updated {stamp(row.updated_at)}</span><span>Lead {lead?.id || '—'}</span></div></article>; })}</div></section>}
    {loading ? <div className="admin-empty">Loading reviews…</div> : visible.length === 0 ? <div className="admin-empty">No reviews match this filter.</div> : <div className="admin-review-list">{visible.map((review) => {
      const supplier = one(review.supplier); const customer = one(review.customer); const outcome = one(review.outcome);
      return <article className="admin-review-card" key={review.id}>
        <div className="admin-review-card-heading"><div><strong>{supplier?.business_name || 'Supplier'}</strong><span>{customer?.name || 'Customer'} · {customer?.email || 'No email'}</span></div><span className={`admin-state-${review.moderation_status === 'approved' ? 'good' : review.moderation_status === 'rejected' || review.moderation_status === 'hidden' ? 'bad' : 'wait'}`}>{review.moderation_status}</span></div>
        <div className="admin-review-stars" aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)} <small>{review.rating}/5</small></div>
        <h3>{review.title}</h3><p>{review.body}</p>
        <div className="admin-review-proof"><span>Verified completion: {outcome?.status === 'completed' ? 'Customer and supplier confirmed' : 'Confirmation unavailable'}</span><span>Submitted {stamp(review.created_at)}</span><span>Offer {review.lead_offer_id}</span></div>
        {review.supplier_response && <div className="admin-review-response"><strong>Supplier response</strong><p>{review.supplier_response}</p></div>}
        {canWrite && <div className="admin-review-actions"><button className="button button-small" type="button" disabled={busy === review.id || review.moderation_status === 'approved'} onClick={() => void moderate(review.id, 'approved')}>Approve & publish</button><button className="button button-small button-secondary" type="button" disabled={busy === review.id || review.moderation_status === 'rejected'} onClick={() => void moderate(review.id, 'rejected')}>Reject</button><button className="button button-small button-secondary" type="button" disabled={busy === review.id || review.moderation_status === 'hidden'} onClick={() => void moderate(review.id, 'hidden')}>Hide</button></div>}
      </article>;
    })}</div>}
  </section>;
}
