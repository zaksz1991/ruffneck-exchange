'use client';

import { useCallback, useEffect, useState } from 'react';

type Supplier = {
  id: string; business_name: string; contact_name: string; email: string; phone: string;
  business_type: string; category: string; state: string; status: string; created_at: string;
};
type Listing = {
  id: string; title: string; listing_type: string; category: string; state: string;
  status: string; created_at: string; supplier: { business_name: string; status: string };
};
type Lead = {
  id: string; request_type: string; name: string; email: string | null; phone: string;
  state: string; city: string | null; category: string; details: string;
  preferred_contact: string; status: string; contact_release_status: string; created_at: string;
};
type Overview = { suppliers: Supplier[]; listings: Listing[]; leads: Lead[]; counts: { suppliers: number; listings: number; leads: number } };

const leadStatuses = ['new', 'qualifying', 'qualified', 'matched', 'closed', 'invalid'];

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AdminConsole() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load operations data.');
      setData(result as Overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load operations data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function update(resource: 'supplier' | 'listing' | 'lead', id: string, status: string) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, id, status }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'The update could not be saved.');
      setNotice(result.message || 'Update saved.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The update could not be saved.');
    } finally {
      setBusyId('');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/admin/login');
  }

  return <section className="admin-console">
    <div className="admin-toolbar"><div><span className="admin-private-tag">PRIVATE · AUTHORISED ACCESS</span><p>Use the refresh control after reviewing records in another session.</p></div><div className="admin-toolbar-actions"><button className="button button-small button-dark" type="button" onClick={() => void refresh()} disabled={loading}>Refresh queue</button><button className="button button-small" type="button" onClick={() => void logout()}>Sign out</button></div></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !data ? <div className="empty-state">Loading private operations data…</div> : null}
    {data && <>
      <div className="admin-stat-grid">
        <article><span>Pending suppliers</span><strong>{data.counts.suppliers}</strong></article>
        <article><span>Pending listings</span><strong>{data.counts.listings}</strong></article>
        <article><span>Open customer leads</span><strong>{data.counts.leads}</strong></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">BUSINESS REVIEW</p><h2>Supplier applications</h2></div><span>{data.suppliers.length} awaiting review</span></div>
        {data.suppliers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Contact</th><th>Category / location</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{data.suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.business_name}</strong><small>{supplier.business_type}</small></td><td><strong>{supplier.contact_name}</strong><small>{supplier.email}</small><small>{supplier.phone}</small></td><td>{supplier.category}<small>{supplier.state}</small></td><td>{dateLabel(supplier.created_at)}</td><td className="admin-actions"><button type="button" disabled={!!busyId} onClick={() => void update('supplier', supplier.id, 'approved')}>Approve</button><button className="reject" type="button" disabled={!!busyId} onClick={() => void update('supplier', supplier.id, 'rejected')}>Reject</button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No pending supplier applications.</div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">CATALOGUE REVIEW</p><h2>Product and service listings</h2></div><span>{data.listings.length} awaiting review</span></div>
        {data.listings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Offer</th><th>Supplier</th><th>Category / location</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{data.listings.map((listing) => <tr key={listing.id}><td><strong>{listing.title}</strong><small>{listing.listing_type}</small></td><td>{listing.supplier?.business_name || 'Supplier record unavailable'}<small>Supplier status: {listing.supplier?.status || 'unknown'}</small></td><td>{listing.category}<small>{listing.state}</small></td><td>{dateLabel(listing.created_at)}</td><td className="admin-actions"><button type="button" disabled={!!busyId || listing.supplier?.status !== 'approved'} title={listing.supplier?.status !== 'approved' ? 'Approve the supplier first' : 'Approve listing'} onClick={() => void update('listing', listing.id, 'approved')}>Approve</button><button className="reject" type="button" disabled={!!busyId} onClick={() => void update('listing', listing.id, 'rejected')}>Reject</button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No pending catalogue listings.</div>}
        <p className="admin-footnote">A listing can only be approved after its supplier application is approved. Each offer is reviewed separately.</p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">CUSTOMER ACQUISITION</p><h2>Lead qualification queue</h2></div><span>{data.leads.length} recent requests</span></div>
        {data.leads.length ? <div className="admin-table-wrap"><table className="admin-table admin-lead-table"><thead><tr><th>Customer / contact</th><th>Requirement</th><th>Location</th><th>Created</th><th>Workflow</th></tr></thead><tbody>{data.leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small>{lead.phone}</small><small>{lead.email || 'No email provided'}</small><small>Preferred: {lead.preferred_contact}</small></td><td><strong>{lead.category}</strong><small>{lead.request_type}</small><details><summary>View requirement</summary><p>{lead.details}</p></details></td><td>{[lead.city, lead.state].filter(Boolean).join(', ')}</td><td>{dateLabel(lead.created_at)}</td><td><select aria-label={`Status for lead ${lead.id}`} value={lead.status} disabled={!!busyId} onChange={(event) => void update('lead', lead.id, event.target.value)}>{leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><small>Contact release: {lead.contact_release_status}</small></td></tr>)}</tbody></table></div> : <div className="admin-empty">No customer requests have been submitted.</div>}
        <p className="admin-footnote">Changing a lead's workflow status does not release customer contact details. Contact release remains locked until the separate payment and customer-authorisation requirements are satisfied.</p>
      </section>
    </>}
  </section>;
}
