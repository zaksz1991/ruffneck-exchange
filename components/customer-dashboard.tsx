'use client';

import { CommercialQuoteConversation } from '@/components/commercial-quote-conversation';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Message = {
  id: string;
  sender_role: string;
  sender_name: string;
  body: string;
  created_at: string;
};

type RequestActivity = {
  id: string;
  event_type: 'request_submitted' | 'status_changed' | 'contact_release_changed';
  previous_status: string | null;
  new_status: string | null;
  previous_contact_release_status: string | null;
  new_contact_release_status: string | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  request_type: string;
  category: string;
  state: string;
  city: string | null;
  details: string;
  status: string;
  contact_release_status: string;
  created_at: string;
  last_activity_at: string | null;
  messages: Message[];
  activity: RequestActivity[];
};

type Customer = { id: string; name: string; email: string };

type CustomerNotification = {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  listing_id: string | null;
  listing_slug: string | null;
  listing_title: string | null;
  supplier_name: string | null;
  related_quote_id: string | null;
  read_at: string | null;
  created_at: string;
};

type SavedListing = {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  category: string;
  state: string;
  city: string | null;
  price_type: string;
  price: number | null;
  currency: string;
  availability_status: string;
  saved_at: string;
  alerts_enabled: boolean;
  image_url: string | null;
  supplier: { public_slug: string; business_name: string };
};

type CustomerCommercialQuote = {
  id: string;
  lead_offer_id: string;
  quote_reference: string;
  title: string;
  scope_description: string;
  total_amount: number;
  currency: string;
  delivery_terms: string;
  estimated_fulfilment: string | null;
  valid_until: string;
  status: 'submitted' | 'selected' | 'not_selected' | 'declined' | 'withdrawn' | 'expired' | 'revision_requested';
  created_at: string;
  responded_at: string | null;
  revision_of_quote_id?: string | null;
  revision_request_note?: string | null;
  revision_requested_at?: string | null;
};

type IntroducedOffer = {
  id: string;
  lead_id: string;
  anonymised_summary: string;
  payment_status: string;
  contact_released: boolean;
  created_at: string;
  category: string;
  state: string;
  city: string | null;
  supplier: { business_name: string; profile_url: string | null } | null;
  outcome: { status: 'awaiting_confirmation' | 'completed' | 'cancelled' | 'disputed'; customer_outcome: string | null; supplier_outcome: string | null; completed_at: string | null } | null;
  review: { id: string; rating: number; title: string; body: string; moderation_status: string; created_at: string } | null;
  can_confirm_outcome: boolean;
  quotes: CustomerCommercialQuote[];
};

const MAX_COMPARE_LISTINGS = 3;

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function quoteMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toLocaleString('en-NG')}`;
  }
}

function requestStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    new: 'Received',
    qualifying: 'Under review',
    qualified: 'Qualified',
    matched: 'Supplier match available',
    closed: 'Closed',
    invalid: 'Unable to process',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'Not recorded';
}

function contactReleaseLabel(value: string | null) {
  const labels: Record<string, string> = {
    locked: 'Your contact details remain private',
    customer_approved: 'Your approval is recorded; contact release is pending',
    released: 'The approved supplier introduction has been released',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'Not recorded';
}

function requestActivityTitle(item: RequestActivity) {
  if (item.event_type === 'request_submitted') return 'Request received by RNX';
  if (item.event_type === 'status_changed') return 'Request status updated';
  if (item.event_type === 'contact_release_changed') return 'Introduction permission updated';
  return 'Request updated';
}

function requestActivityDetail(item: RequestActivity) {
  if (item.event_type === 'status_changed') {
    return `${requestStatusLabel(item.previous_status)} → ${requestStatusLabel(item.new_status)}`;
  }
  if (item.event_type === 'contact_release_changed') {
    return `${contactReleaseLabel(item.previous_contact_release_status)} → ${contactReleaseLabel(item.new_contact_release_status)}`;
  }
  return item.new_status
    ? `Your request was recorded with the status: ${requestStatusLabel(item.new_status)}.`
    : 'Your request was recorded. Earlier status history is not available.';
}

function availabilityLabel(value: string) {
  const labels: Record<string, string> = {
    available: 'Supplier reports available',
    limited: 'Limited availability',
    on_request: 'Confirm on request',
    out_of_stock: 'Supplier reports currently unavailable',
    unconfirmed: 'Not confirmed by supplier',
  };
  return labels[value] || 'Availability not confirmed';
}

export function CustomerDashboard() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [introductions, setIntroductions] = useState<IntroducedOffer[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [savedBusy, setSavedBusy] = useState('');
  const [alertBusy, setAlertBusy] = useState('');
  const [notificationBusy, setNotificationBusy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [quoteCompareIdsByRequest, setQuoteCompareIdsByRequest] = useState<Record<string, string[]>>({});
  const [revisionForms, setRevisionForms] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meResponse, requestResponse, savedResponse, notificationResponse, introductionResponse] = await Promise.all([
        fetch('/api/customer/me', { cache: 'no-store' }),
        fetch('/api/customer/requests', { cache: 'no-store' }),
        fetch('/api/customer/saved-listings', { cache: 'no-store' }),
        fetch('/api/customer/notifications', { cache: 'no-store' }),
        fetch('/api/customer/offers', { cache: 'no-store' }),
      ]);
      if (meResponse.status === 401 || requestResponse.status === 401 || savedResponse.status === 401 || notificationResponse.status === 401 || introductionResponse.status === 401) {
        window.location.assign('/customer/login');
        return;
      }
      const meData = await meResponse.json();
      const requestData = await requestResponse.json();
      const savedData = await savedResponse.json();
      const notificationData = notificationResponse.ok
        ? await notificationResponse.json()
        : { notifications: [], unreadCount: 0 };
      const introductionData = await introductionResponse.json().catch(() => ({}));
      if (!requestResponse.ok) throw new Error(requestData.error || 'Could not load requests.');
      if (!savedResponse.ok) throw new Error(savedData.error || 'Could not load saved offers.');
      if (!introductionResponse.ok) throw new Error(introductionData.error || 'Could not load supplier introductions.');
      const nextSavedListings: SavedListing[] = savedData.savedListings || [];
      const nextSavedIds = new Set(nextSavedListings.map((item) => item.id));
      setCustomer(meData.customer);
      setRequests(requestData.requests || []);
      setSavedListings(nextSavedListings);
      const nextIntroductions = (introductionData.offers || []) as IntroducedOffer[];
      setIntroductions(nextIntroductions);
      const comparableQuoteIds = new Set(nextIntroductions.flatMap((offer) => (offer.quotes || [])
        .filter((quote) => quote.status === 'submitted' || quote.status === 'selected')
        .map((quote) => quote.id)));
      setQuoteCompareIdsByRequest((current) => {
        const next: Record<string, string[]> = {};
        for (const [requestId, ids] of Object.entries(current)) {
          const retained = ids.filter((id) => comparableQuoteIds.has(id)).slice(0, 3);
          if (retained.length) next[requestId] = retained;
        }
        return next;
      });
      setNotifications(notificationData.notifications || []);
      setUnreadNotificationCount(Number(notificationData.unreadCount || 0));
      setCompareIds((current) => current.filter((id) => nextSavedIds.has(id)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function logout() {
    await fetch('/api/customer/logout', { method: 'POST' });
    window.location.assign('/customer/login');
  }

  async function removeSaved(listingId: string) {
    setSavedBusy(listingId);
    setError('');
    try {
      const response = await fetch('/api/customer/saved-listings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not remove this saved offer.');
      setSavedListings((items) => items.filter((item) => item.id !== listingId));
      setCompareIds((items) => items.filter((id) => id !== listingId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this saved offer.');
    } finally {
      setSavedBusy('');
    }
  }


  async function updateSavedOfferAlerts(listingId: string, enabled: boolean) {
    setAlertBusy(listingId);
    setError('');
    try {
      const response = await fetch('/api/customer/saved-listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, alerts_enabled: enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update email alerts.');
      setSavedListings((items) => items.map((item) => item.id === listingId ? { ...item, alerts_enabled: enabled } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update email alerts.');
    } finally {
      setAlertBusy('');
    }
  }

  async function markNotificationRead(notificationId?: string) {
    setNotificationBusy(notificationId || 'all');
    setError('');
    try {
      const response = await fetch('/api/customer/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationId ? { notification_id: notificationId } : { mark_all_read: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update notifications.');

      const readAt = new Date().toISOString();
      if (notificationId) {
        setNotifications((items) => items.map((item) => item.id === notificationId && !item.read_at ? { ...item, read_at: readAt } : item));
        setUnreadNotificationCount((count) => Math.max(0, count - data.updatedCount));
      } else {
        setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || readAt })));
        setUnreadNotificationCount(0);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update notifications.');
    } finally {
      setNotificationBusy('');
    }
  }

  function toggleCompare(listingId: string) {
    setCompareIds((current) => {
      if (current.includes(listingId)) return current.filter((id) => id !== listingId);
      if (current.length >= MAX_COMPARE_LISTINGS) return current;
      return [...current, listingId];
    });
  }

  function toggleCommercialQuoteCompare(requestId: string, quoteId: string) {
    setQuoteCompareIdsByRequest((current) => {
      const selected = current[requestId] || [];
      const next = selected.includes(quoteId)
        ? selected.filter((id) => id !== quoteId)
        : selected.length < 3 ? [...selected, quoteId] : selected;
      const updated = { ...current };
      if (next.length) updated[requestId] = next;
      else delete updated[requestId];
      return updated;
    });
  }

  function savedPrice(item: SavedListing) {
    if (item.price_type === 'enquiry' || item.price === null) return 'Price on request';
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: item.currency || 'NGN',
        maximumFractionDigits: 0,
      }).format(Number(item.price));
    } catch {
      return `${item.currency || 'NGN'} ${item.price}`;
    }
  }

  const comparisonListings = useMemo(
    () => savedListings.filter((item) => compareIds.includes(item.id)),
    [savedListings, compareIds],
  );

  async function respondToCommercialQuote(quote: CustomerCommercialQuote, action: 'select' | 'decline') {
    const prompt = action === 'select'
      ? 'Mark this quotation as your preferred proposal? This records your preference only. It does not make a payment or create a contract.'
      : 'Decline this quotation? The supplier may submit a revised proposal.';
    if (!window.confirm(prompt)) return;
    setBusy(quote.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/customer/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/customer/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Quotation decision could not be saved.');
      setNotice(result.message || 'Quotation decision saved.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Quotation decision could not be saved.');
    } finally {
      setBusy('');
    }
  }

  async function requestCommercialQuoteRevision(event: React.FormEvent<HTMLFormElement>, quote: CustomerCommercialQuote) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const revisionNote = String(form.get('revision_note') || '').trim();
    if (revisionNote.length < 10 || revisionNote.length > 800) {
      setError('Explain the requested changes in 10–800 characters.');
      return;
    }
    if (!window.confirm('Send this revision request to the supplier? The existing quotation will be preserved and no contract or payment will be created.')) return;
    setBusy(quote.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/customer/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_revision', revision_note: revisionNote }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign('/customer/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Quotation revision request could not be sent.');
      setRevisionForms((current) => ({ ...current, [quote.id]: false }));
      formElement.reset();
      setNotice(result.message || 'Quotation revision request sent.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Quotation revision request could not be sent.');
    } finally {
      setBusy('');
    }
  }

  async function confirmTransactionOutcome(offer: IntroducedOffer, outcome: 'completed' | 'not_completed') {
    const prompt = outcome === 'completed'
      ? 'Confirm that the transaction with this introduced supplier was completed. Both parties must confirm before a verified review can be submitted.'
      : 'Confirm that the transaction was not completed. This will be compared with the supplier response.';
    if (!window.confirm(prompt)) return;
    setBusy(offer.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/customer/offers/${offer.id}/outcome`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Transaction outcome could not be recorded.');
      setNotice(result.message || 'Transaction outcome recorded.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transaction outcome could not be recorded.');
    } finally { setBusy(''); }
  }

  async function submitVerifiedReview(event: React.FormEvent<HTMLFormElement>, offer: IntroducedOffer) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(offer.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/customer/offers/${offer.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: Number(values.get('rating')), title: values.get('title'), body: values.get('body') }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Verified review could not be submitted.');
      form.reset(); setNotice(result.message || 'Review submitted for moderation.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verified review could not be submitted.');
    } finally { setBusy(''); }
  }

  async function send(leadId: string) {
    const body = (drafts[leadId] || '').trim();
    if (body.length < 2) return;
    setBusy(leadId);
    setError('');
    try {
      const response = await fetch('/api/customer/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Message failed.');
      setDrafts((current) => ({ ...current, [leadId]: '' }));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Message failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="customer-dashboard">
      <div className="customer-toolbar">
        <div>
          <p className="eyebrow">CUSTOMER ACCOUNT</p>
          <h2>{customer ? `Welcome, ${customer.name}` : 'Your requests'}</h2>
          <p>{customer?.email}</p>
        </div>
        <div className="customer-toolbar-actions">
          <button className="button button-small button-dark" onClick={() => void refresh()} disabled={loading}>Refresh</button>
          <button className="button button-small" onClick={() => void logout()}>Sign out</button>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}

      {loading ? (
        <div className="admin-empty">Loading your requests…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>No account-linked requests yet</h3>
          <p>When you submit a request while signed in, it will appear here. Guest requests can still be followed through their private tracking links.</p>
          <a className="button" href="/request">Submit a request</a>
        </div>
      ) : requests.map((item) => {
        const requestOffers = introductions.filter((offer) => offer.lead_id === item.id);
        const requestQuotes = requestOffers.flatMap((offer) => offer.quotes.map((quote) => ({
          ...quote,
          supplierName: offer.supplier?.business_name || 'Introduced supplier',
          supplierProfileUrl: offer.supplier?.profile_url || null,
        })));
        const selectedQuoteIds = quoteCompareIdsByRequest[item.id] || [];
        const selectedQuotes = requestQuotes.filter((quote) => selectedQuoteIds.includes(quote.id));
        const comparisonCurrencies = [...new Set(selectedQuotes.map((quote) => quote.currency))];
        return (
        <article className="customer-request-card" key={item.id}>
          <div className="customer-request-heading">
            <div>
              <span className="eyebrow">{item.request_type.replace('_', ' ')}</span>
              <h3>{item.category}</h3>
              <p>{[item.city, item.state].filter(Boolean).join(', ')} · Submitted {date(item.created_at)}</p>
            </div>
            <span className={`customer-status status-${item.status}`}>{item.status.replace('_', ' ')}</span>
          </div>
          <p className="customer-request-details">{item.details}</p>
          <div className="customer-request-meta">
            <span>Contact release: {contactReleaseLabel(item.contact_release_status)}</span>
            <span>Last activity: {date(item.last_activity_at || item.created_at)}</span>
          </div>
          <section className="customer-request-activity" aria-label="Request progress timeline">
            <div className="customer-request-activity-heading">
              <h4>Request progress</h4>
              <span>{item.activity.length} recorded updates</span>
            </div>
            {item.activity.length ? (
              <ol className="customer-request-activity-list">
                {item.activity.map((event) => (
                  <li className="customer-request-activity-item" key={event.id}>
                    <span className="customer-request-activity-dot" aria-hidden="true" />
                    <div>
                      <strong>{requestActivityTitle(event)}</strong>
                      <p>{requestActivityDetail(event)}</p>
                      <time dateTime={event.created_at}>{date(event.created_at)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="customer-request-activity-empty">No progress events have been recorded yet. Refresh this page to check for updates.</p>
            )}
          </section>
          {requestOffers.length > 0 && <section className="customer-introductions" aria-label="Supplier introductions and transaction confirmations">
            <div className="customer-introductions-heading"><div><p className="eyebrow">AUTHORISED INTRODUCTIONS</p><h4>Supplier transaction follow-up</h4></div><span>{requestOffers.length} introductions</span></div>
            {requestOffers.map((offer) => <article className="customer-introduction-card" key={offer.id}>
              <div className="customer-introduction-top"><strong>{offer.supplier?.business_name || 'Supplier introduction'}</strong><span className={`customer-status ${offer.outcome?.status === 'completed' ? 'status-qualified' : offer.outcome?.status === 'disputed' ? 'status-invalid' : ''}`}>{offer.outcome?.status?.replaceAll('_', ' ') || 'Awaiting transaction confirmation'}</span></div>
              <p>{offer.anonymised_summary}</p>
              {offer.supplier?.profile_url && <a className="text-link" href={offer.supplier.profile_url}>View introduced supplier ↗</a>}
              {offer.quotes?.length > 0 && <section className="rnx-customer-quotes" aria-label="Supplier commercial quotations">
                <div><p className="eyebrow">COMMERCIAL PROPOSALS</p><h5>Supplier quotations</h5><p>These proposals are separate from the RNX introduction fee. Compare scope, amount, delivery terms and validity.</p></div>
                {offer.quotes.map((quote) => <article className="rnx-customer-quote" id={`quote-${quote.id}`} key={quote.id}>
                  <div className="rnx-customer-quote-heading"><strong>{quote.quote_reference} · {quote.title}</strong><span className={`admin-state-${quote.status === 'selected' ? 'good' : quote.status === 'submitted' || quote.status === 'revision_requested' ? 'wait' : quote.status === 'declined' || quote.status === 'withdrawn' ? 'bad' : 'wait'}`}>{quote.status.replaceAll('_', ' ')}</span></div>
                  {quote.revision_of_quote_id && <small className="rnx-quote-revision-line">Revised from {offer.quotes.find((previousQuote) => previousQuote.id === quote.revision_of_quote_id)?.quote_reference || 'an earlier quotation'}.</small>}
                  <strong className="rnx-customer-quote-amount">{quoteMoney(quote.total_amount, quote.currency)}</strong>
                  <p>{quote.scope_description}</p>
                  <dl><div><dt>Estimated fulfilment</dt><dd>{quote.estimated_fulfilment || 'Not stated'}</dd></div><div><dt>Valid until</dt><dd>{date(quote.valid_until)}</dd></div></dl>
                  <p className="rnx-customer-quote-terms">{quote.delivery_terms}</p>
                  <a className="button button-small button-secondary rnx-quote-document-link" href={`/customer/quotes/${quote.id}/document`} target="_blank" rel="noreferrer">Open print-ready quotation ↗</a>
                  <CommercialQuoteConversation quoteId={quote.id} quoteReference={quote.quote_reference} audience="customer" canSend={quote.status === 'submitted' || quote.status === 'selected'} />
                  {(quote.status === 'submitted' || quote.status === 'selected') && <button className="button button-small button-secondary rnx-quote-compare-toggle" type="button" onClick={() => toggleCommercialQuoteCompare(item.id, quote.id)} disabled={!(selectedQuoteIds.includes(quote.id)) && selectedQuoteIds.length >= 3}>{selectedQuoteIds.includes(quote.id) ? 'Remove from comparison' : selectedQuoteIds.length >= 3 ? 'Comparison limit reached' : 'Add to comparison'}</button>}
                  {quote.status === 'submitted' && <>
                    <div className="customer-outcome-actions"><button className="button button-small" type="button" disabled={busy === quote.id} onClick={() => void respondToCommercialQuote(quote, 'select')}>Mark as preferred</button><button className="button button-small button-secondary" type="button" disabled={busy === quote.id} onClick={() => void respondToCommercialQuote(quote, 'decline')}>Decline quotation</button><button className="button button-small button-secondary" type="button" disabled={busy === quote.id} onClick={() => setRevisionForms((current) => ({ ...current, [quote.id]: !current[quote.id] }))}>{revisionForms[quote.id] ? 'Close revision request' : 'Request changes'}</button></div>
                    {revisionForms[quote.id] && <form className="rnx-quote-revision-form" onSubmit={(event) => void requestCommercialQuoteRevision(event, quote)}><label>What should the supplier revise?<textarea name="revision_note" required minLength={10} maxLength={800} rows={3} placeholder="For example, clarify quantities, adjust the scope, separate delivery charges or extend the validity period." /></label><p>The original quotation remains in your history. The supplier may submit a new version linked to this one.</p><button className="button button-small" type="submit" disabled={busy === quote.id}>{busy === quote.id ? 'Sending request…' : 'Send revision request'}</button></form>}
                  </>}
                  {quote.status === 'revision_requested' && <div className="rnx-quote-revision-note"><strong>Revision requested {quote.revision_requested_at ? `· ${date(quote.revision_requested_at)}` : ''}</strong><p>{quote.revision_request_note || 'You asked the supplier to revise this quotation.'}</p><small>The supplier has been notified. A revised proposal will appear as a separate quotation record.</small></div>}
                  {quote.status === 'selected' && <p className="form-status">You marked this as your preferred proposal. Confirm the final agreement and payment directly with the supplier.</p>}
                  {quote.status === 'not_selected' && <small>This quotation was not selected because you marked another proposal as preferred.</small>}
                  {quote.status === 'expired' && <small>This quotation has expired. Ask the supplier for an updated proposal.</small>}
                </article>)}
                <small className="rnx-quote-disclaimer">Marking a quotation as preferred is not a payment, contract or RNX guarantee. Confirm final specifications, taxes, payment destination, delivery, warranties and other terms directly with the supplier before committing funds.</small>
              </section>}
              {!offer.contact_released && <small className="fine-print">Supplier identity remains private until RNX has recorded payment, customer approval and contact release.</small>}
              {offer.outcome?.status === 'disputed' && <p className="form-error">Your transaction outcome differs from the supplier's confirmation. RNX Operations may contact both parties to review the discrepancy.</p>}
              {offer.contact_released && offer.can_confirm_outcome && !offer.outcome?.customer_outcome && offer.outcome?.status !== 'disputed' && <div className="customer-outcome-actions"><p>Confirm whether the introduced transaction was completed. The supplier must also confirm independently.</p><button className="button button-small" type="button" disabled={busy === offer.id} onClick={() => void confirmTransactionOutcome(offer, 'completed')}>Confirm completed</button><button className="button button-small button-secondary" type="button" disabled={busy === offer.id} onClick={() => void confirmTransactionOutcome(offer, 'not_completed')}>Not completed</button></div>}
              {offer.outcome?.customer_outcome && <p className="fine-print">Your confirmation: {offer.outcome.customer_outcome.replaceAll('_', ' ')}. Supplier confirmation: {offer.outcome.supplier_outcome?.replaceAll('_', ' ') || 'Awaiting supplier'}.</p>}
              {offer.outcome?.status === 'completed' && !offer.review && <form className="customer-review-form" onSubmit={(event) => void submitVerifiedReview(event, offer)}>
                <h5>Leave a verified supplier review</h5>
                <p>Both parties confirmed completion. Your review will be checked by RNX before it appears publicly. Do not include personal contact details.</p>
                <label>Rating<select name="rating" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Satisfactory</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label>
                <label>Review title<input name="title" required minLength={3} maxLength={120} placeholder="Summarise your experience" /></label>
                <label>Your review<textarea name="body" required minLength={20} maxLength={2000} rows={4} placeholder="Describe the product or service, communication and fulfilment experience." /></label>
                <button className="button button-small" type="submit" disabled={busy === offer.id}>{busy === offer.id ? 'Submitting…' : 'Submit verified review'}</button>
              </form>}
              {offer.review && <div className="customer-review-submitted"><strong>Your review · {offer.review.rating}/5</strong><span>{offer.review.moderation_status === 'approved' ? 'Published on the supplier profile' : offer.review.moderation_status === 'rejected' ? 'Not approved for publication' : offer.review.moderation_status === 'hidden' ? 'Hidden by RNX moderation' : 'Submitted · awaiting RNX moderation'}</span><h5>{offer.review.title}</h5><p>{offer.review.body}</p></div>}
            </article>)}
            {selectedQuotes.length > 0 && <section className="rnx-commercial-quote-comparison" aria-label="Commercial quotation comparison">
              <div className="rnx-commercial-quote-comparison-heading">
                <div><p className="eyebrow">DECISION SUPPORT</p><h5>Compare commercial quotations</h5><p>{selectedQuotes.length} of 3 quotations selected for this request. You can compare only proposals attached to this same sourcing request.</p></div>
                <button className="button button-small button-secondary" type="button" onClick={() => setQuoteCompareIdsByRequest((current) => { const next = { ...current }; delete next[item.id]; return next; })}>Clear comparison</button>
              </div>
              {selectedQuotes.length < 2 && <p className="rnx-quote-comparison-hint">Add at least one more quotation to see the side-by-side comparison.</p>}
              <div className="rnx-commercial-quote-comparison-grid">
                {selectedQuotes.map((quote) => <article className="rnx-commercial-quote-comparison-card" key={quote.id}>
                  <div><span className="eyebrow">{quote.quote_reference}</span><strong>{quote.supplierName}</strong><small>{quote.title}</small></div>
                  <strong className="rnx-commercial-quote-comparison-amount">{quoteMoney(quote.total_amount, quote.currency)}</strong>
                  <dl>
                    <div><dt>Status</dt><dd>{quote.status.replaceAll('_', ' ')}</dd></div>
                    <div><dt>Scope / specification</dt><dd>{quote.scope_description}</dd></div>
                    <div><dt>Delivery and payment terms</dt><dd>{quote.delivery_terms}</dd></div>
                    <div><dt>Estimated fulfilment</dt><dd>{quote.estimated_fulfilment || 'Not stated'}</dd></div>
                    <div><dt>Valid until</dt><dd>{date(quote.valid_until)}</dd></div>
                  </dl>
                  {quote.supplierProfileUrl && <a className="text-link" href={quote.supplierProfileUrl}>View supplier profile ↗</a>}
                  <button className="button button-small button-secondary" type="button" onClick={() => toggleCommercialQuoteCompare(item.id, quote.id)}>Remove</button>
                </article>)}
              </div>
              <p className="rnx-quote-comparison-currency-note">{comparisonCurrencies.length === 1 ? `All displayed amounts are in ${comparisonCurrencies[0]}. Compare the scope and terms as well as the amount.` : 'These quotations use different currencies. Amounts are displayed as submitted and are not converted; do not compare their numeric values directly.'} Supplier proposals are not independently verified by RNX.</p>
            </section>}
          </section>}
          <div className="customer-thread">
            <h4>Conversation with RNX</h4>
            {item.messages.length ? item.messages.map((message) => (
              <div className={`customer-message ${message.sender_role === 'operations' ? 'is-operations' : 'is-customer'}`} key={message.id}>
                <div><strong>{message.sender_name}</strong><small>{date(message.created_at)}</small></div>
                <p>{message.body}</p>
              </div>
            )) : <p className="fine-print">No messages yet. Send a message to ask for an update or clarify your request.</p>}
            <div className="customer-compose">
              <textarea
                rows={3}
                maxLength={3000}
                value={drafts[item.id] || ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Message RNX Operations…"
              />
              <button className="button button-small" disabled={busy === item.id || (drafts[item.id] || '').trim().length < 2} onClick={() => void send(item.id)}>
                {busy === item.id ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </div>
        </article>
        );
      })}

      {!loading && (
        <section className="customer-notifications-section" aria-labelledby="customer-notifications-title">
          <div className="customer-notifications-heading">
            <div>
              <p className="eyebrow">ACCOUNT ACTIVITY</p>
              <h3 id="customer-notifications-title">Notifications</h3>
              <p>Updates about saved offers and commercial quotations from suppliers you have been introduced to. Email alerts remain a separate preference on each saved offer.</p>
            </div>
            <div className="customer-notifications-heading-actions">
              <span>{unreadNotificationCount} unread</span>
              <button
                className="customer-compare-clear"
                type="button"
                disabled={unreadNotificationCount === 0 || notificationBusy === 'all'}
                onClick={() => void markNotificationRead()}
              >
                {notificationBusy === 'all' ? 'Updating…' : 'Mark all as read'}
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="customer-notifications-empty">No notifications yet. Saved-offer changes, new commercial quotations and private quotation messages will appear here.</div>
          ) : (
            <div className="customer-notifications-list">
              {notifications.map((item) => (
                <article className={`customer-notification-card${item.read_at ? '' : ' is-unread'}`} key={item.id}>
                  <div className="customer-notification-topline">
                    <strong>{item.title}</strong>
                    <time dateTime={item.created_at}>{date(item.created_at)}</time>
                  </div>
                  <p>{item.message}</p>
                  {item.supplier_name && <small>Supplier: {item.supplier_name}</small>}
                  <div className="customer-notification-actions">
                    {item.listing_slug && <a className="text-link" href={`/marketplace/listing/${encodeURIComponent(item.listing_slug)}`}>View updated offer ↗</a>}
                    {item.related_quote_id && <a className="text-link" href={`/customer/dashboard#quote-${encodeURIComponent(item.related_quote_id)}`}>{item.notification_type === 'commercial_quote_message' ? 'Open quotation conversation' : 'Review commercial quotation'} ↗</a>}
                    {!item.read_at && (
                      <button
                        className="customer-compare-clear"
                        type="button"
                        disabled={notificationBusy === item.id}
                        onClick={() => void markNotificationRead(item.id)}
                      >
                        {notificationBusy === item.id ? 'Updating…' : 'Mark as read'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && (
        <section className="customer-saved-section">
          <div className="customer-saved-heading">
            <div>
              <p className="eyebrow">YOUR SHORTLIST</p>
              <h3>Saved offers</h3>
              <p>Offers you bookmarked from the public marketplace. Enable email alerts on any offer to hear about published price or availability changes.</p>
            </div>
            <span>{savedListings.length} saved</span>
          </div>

          {savedListings.length === 0 ? (
            <div className="customer-saved-empty">
              No saved offers yet. Browse the marketplace and save offers you want to revisit.
              <a className="text-link" href="/marketplace">Explore the marketplace ↗</a>
            </div>
          ) : (
            <>
              <div className="customer-compare-controls">
                <div>
                  <strong>{compareIds.length} of {MAX_COMPARE_LISTINGS} offers selected</strong>
                  <small>Select two or three offers to compare their published details side by side.</small>
                </div>
                <div className="customer-compare-actions">
                  <button
                    className="button button-small button-dark"
                    type="button"
                    disabled={comparisonListings.length < 2}
                    onClick={() => setCompareOpen((open) => !open)}
                    aria-expanded={compareOpen}
                  >
                    {compareOpen ? 'Hide comparison' : 'Compare selected'}
                  </button>
                  <button className="customer-compare-clear" type="button" disabled={compareIds.length === 0} onClick={() => { setCompareIds([]); setCompareOpen(false); }}>
                    Clear selection
                  </button>
                </div>
              </div>

              <div className="customer-saved-grid">
                {savedListings.map((item) => {
                  const selected = compareIds.includes(item.id);
                  const atLimit = compareIds.length >= MAX_COMPARE_LISTINGS;
                  return (
                    <article className={`customer-saved-card${selected ? ' is-comparing' : ''}`} key={item.id}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} loading="lazy" decoding="async" />
                      ) : (
                        <div className="customer-saved-placeholder"><span>{item.category}</span><strong>RUFFNECK EXCHANGE</strong></div>
                      )}
                      <div className="customer-saved-card-body">
                        <span className="eyebrow">{item.listing_type} · {item.category}</span>
                        <h4><a href={`/marketplace/listing/${encodeURIComponent(item.slug)}`}>{item.title}</a></h4>
                        <p>{[item.city, item.state].filter(Boolean).join(', ')}</p>
                        <strong>{savedPrice(item)}</strong>
                        <small>Supplier: <a href={`/suppliers/${encodeURIComponent(item.supplier.public_slug)}`}>{item.supplier.business_name}</a></small>
                        <div className="customer-saved-actions">
                          <a className="button button-small" href={`/marketplace/listing/${encodeURIComponent(item.slug)}`}>View offer</a>
                          <button
                            className={`button button-small ${selected ? '' : 'button-secondary'}`}
                            type="button"
                            aria-pressed={selected}
                            disabled={!selected && atLimit}
                            onClick={() => toggleCompare(item.id)}
                          >
                            {selected ? 'Remove from compare' : atLimit ? 'Compare limit reached' : 'Add to compare'}
                          </button>
                          <button
                            className={`button button-small ${item.alerts_enabled ? '' : 'button-secondary'}`}
                            type="button"
                            aria-pressed={item.alerts_enabled}
                            disabled={alertBusy === item.id}
                            onClick={() => void updateSavedOfferAlerts(item.id, !item.alerts_enabled)}
                          >
                            {alertBusy === item.id ? 'Saving…' : item.alerts_enabled ? 'Turn off email alerts' : 'Get email alerts'}
                          </button>
                          <button className="button button-small button-secondary" type="button" disabled={savedBusy === item.id} onClick={() => void removeSaved(item.id)}>
                            {savedBusy === item.id ? 'Removing…' : 'Remove saved'}
                          </button>
                        </div>
                        <small className={`customer-alert-status${item.alerts_enabled ? ' is-enabled' : ''}`}>
                          {item.alerts_enabled ? 'Email alerts are on for published price and availability changes.' : 'Email alerts are off.'}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>

              {compareOpen && comparisonListings.length >= 2 && (
                <section className="customer-comparison-panel" aria-labelledby="customer-comparison-title">
                  <div className="customer-comparison-heading">
                    <div>
                      <p className="eyebrow">SIDE-BY-SIDE REVIEW</p>
                      <h4 id="customer-comparison-title">Offer comparison</h4>
                      <p>Compare the published listing information before contacting a supplier.</p>
                    </div>
                    <button className="button button-small button-secondary" type="button" onClick={() => setCompareOpen(false)}>Close</button>
                  </div>
                  <div className="customer-comparison-scroll" role="region" aria-label="Saved offer comparison" tabIndex={0}>
                    <table className="customer-comparison-table">
                      <thead>
                        <tr>
                          <th scope="col">Details</th>
                          {comparisonListings.map((item) => <th scope="col" key={item.id}>{item.title}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Supplier</th>
                          {comparisonListings.map((item) => <td key={item.id}><a href={`/suppliers/${encodeURIComponent(item.supplier.public_slug)}`}>{item.supplier.business_name}</a></td>)}
                        </tr>
                        <tr>
                          <th scope="row">Category</th>
                          {comparisonListings.map((item) => <td key={item.id}>{item.category}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Listing type</th>
                          {comparisonListings.map((item) => <td key={item.id}>{item.listing_type}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Location</th>
                          {comparisonListings.map((item) => <td key={item.id}>{[item.city, item.state].filter(Boolean).join(', ') || 'Not stated'}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Published price</th>
                          {comparisonListings.map((item) => <td className="customer-comparison-price" key={item.id}>{savedPrice(item)}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Availability</th>
                          {comparisonListings.map((item) => <td key={item.id}>{availabilityLabel(item.availability_status)}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Saved on</th>
                          {comparisonListings.map((item) => <td key={item.id}>{date(item.saved_at)}</td>)}
                        </tr>
                        <tr>
                          <th scope="row">Open listing</th>
                          {comparisonListings.map((item) => <td key={item.id}><a className="button button-small" href={`/marketplace/listing/${encodeURIComponent(item.slug)}`}>View offer</a></td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="customer-comparison-disclaimer">Prices and availability are supplier-reported listing information. Prices remain in their stated currencies and are not converted. RNX does not independently verify stock, price, product quality or delivery terms.</p>
                </section>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
