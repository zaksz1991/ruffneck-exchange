'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Message = {
  id: string;
  sender_role: string;
  sender_name: string;
  body: string;
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

const MAX_COMPARE_LISTINGS = 3;

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
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
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [savedBusy, setSavedBusy] = useState('');
  const [alertBusy, setAlertBusy] = useState('');
  const [notificationBusy, setNotificationBusy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meResponse, requestResponse, savedResponse, notificationResponse] = await Promise.all([
        fetch('/api/customer/me', { cache: 'no-store' }),
        fetch('/api/customer/requests', { cache: 'no-store' }),
        fetch('/api/customer/saved-listings', { cache: 'no-store' }),
        fetch('/api/customer/notifications', { cache: 'no-store' }),
      ]);
      if (meResponse.status === 401 || requestResponse.status === 401 || savedResponse.status === 401 || notificationResponse.status === 401) {
        window.location.assign('/customer/login');
        return;
      }
      const meData = await meResponse.json();
      const requestData = await requestResponse.json();
      const savedData = await savedResponse.json();
      const notificationData = notificationResponse.ok
        ? await notificationResponse.json()
        : { notifications: [], unreadCount: 0 };
      if (!requestResponse.ok) throw new Error(requestData.error || 'Could not load requests.');
      if (!savedResponse.ok) throw new Error(savedData.error || 'Could not load saved offers.');
      const nextSavedListings: SavedListing[] = savedData.savedListings || [];
      const nextSavedIds = new Set(nextSavedListings.map((item) => item.id));
      setCustomer(meData.customer);
      setRequests(requestData.requests || []);
      setSavedListings(nextSavedListings);
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

      {loading ? (
        <div className="admin-empty">Loading your requests…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>No account-linked requests yet</h3>
          <p>When you submit a request while signed in, it will appear here. Guest requests can still be followed through their private tracking links.</p>
          <a className="button" href="/request">Submit a request</a>
        </div>
      ) : requests.map((item) => (
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
            <span>Contact release: {item.contact_release_status}</span>
            <span>Last activity: {date(item.last_activity_at || item.created_at)}</span>
          </div>
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
      ))}

      {!loading && (
        <section className="customer-notifications-section" aria-labelledby="customer-notifications-title">
          <div className="customer-notifications-heading">
            <div>
              <p className="eyebrow">ACCOUNT ACTIVITY</p>
              <h3 id="customer-notifications-title">Notifications</h3>
              <p>Updates about offers you have saved. Email alerts remain a separate preference on each saved offer.</p>
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
            <div className="customer-notifications-empty">No notifications yet. When a saved public offer changes its published price or supplier-reported availability, the update will appear here.</div>
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
