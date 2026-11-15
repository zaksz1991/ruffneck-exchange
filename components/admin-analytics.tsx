'use client';

import { useCallback, useEffect, useState } from 'react';

type CountRow = { label: string; count: number };
type SourceRow = { source: string; leads: number; qualifiedLeads: number; introductions: number; supplierApplications: number };
type Report = {
  days: number; since: string;
  totals: { leads: number; qualifiedLeads: number; openLeads: number; attributedLeads: number; supplierApplications: number; approvedSuppliers: number; attributedSupplierApplications: number; supplierOffers: number; verifiedLeadFeePayments: number; verifiedLeadFeeValueByCurrency: Record<string, number>; introductionsReleased: number; consentedConversionEvents: number };
  sources: SourceRow[]; campaigns: CountRow[]; categories: CountRow[]; states: CountRow[];
  daily: Array<{ date: string; leads: number; suppliers: number; introductions: number }>;
  consentedEvents: CountRow[]; limitations: string[]; capped: boolean;
};

function number(value: number) { return new Intl.NumberFormat('en-NG').format(value || 0); }
function money(value: number) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value || 0); }
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }); }
function csvCell(value: string | number) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, { cache: 'no-store' });
      if (response.status === 401) { window.location.assign('/admin/login'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Analytics report could not be loaded.');
      setData(result as Report);
    } catch (err) { setError(err instanceof Error ? err.message : 'Analytics report could not be loaded.'); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void refresh(); }, [refresh]);

  function exportCsv() {
    if (!data) return;
    const lines = [
      ['Source', 'Customer requests', 'Qualified requests', 'Introductions released', 'Supplier applications'],
      ...data.sources.map((row) => [row.source, row.leads, row.qualifiedLeads, row.introductions, row.supplierApplications]),
      [], ['Metric', 'Value'],
      ...Object.entries(data.totals).map(([label, value]) => [label, value]),
    ];
    const csv = lines.map((row) => row.map((value) => csvCell(value as string | number)).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `rnx-operations-analytics-${days}d.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const cards = data ? [
    ['Customer requests', data.totals.leads], ['Qualified requests', data.totals.qualifiedLeads], ['Introductions released', data.totals.introductionsReleased],
    ['Supplier applications', data.totals.supplierApplications], ['Approved suppliers', data.totals.approvedSuppliers], ['Supplier offers', data.totals.supplierOffers],
    ['Verified lead-fee payments', data.totals.verifiedLeadFeePayments], ['Verified fee value', Object.entries(data.totals.verifiedLeadFeeValueByCurrency || {}).map(([currency, amount]) => `${currency} ${number(amount)}`).join(' · ') || '—'],
  ] as Array<[string, number | string]> : [];

  return <section className="rnx-analytics">
    <div className="supplier-dashboard-toolbar"><div><p className="eyebrow">PRIVATE OPERATIONS INTELLIGENCE</p><h2>Acquisition and conversion report</h2><p>Operational totals and consented first-touch attribution. No customer names, emails, phone numbers or request descriptions are included.</p></div><div className="rnx-analytics-actions"><label>Period<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 365 days</option></select></label><button className="button button-small" onClick={() => void refresh()} disabled={loading}>Refresh</button><button className="button button-small button-dark" onClick={exportCsv} disabled={!data}>Export CSV</button></div></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !data && <p className="admin-empty">Loading report…</p>}
    {data && <>
      <p className="rnx-analytics-period">Reporting period starts {new Date(data.since).toLocaleDateString('en-NG', { dateStyle: 'medium' })}. {data.totals.attributedLeads} of {data.totals.leads} requests and {data.totals.attributedSupplierApplications} of {data.totals.supplierApplications} supplier applications have consented attribution.</p>
      <div className="admin-stat-grid admin-stat-grid-four">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{typeof value === 'number' ? number(value) : value}</strong></article>)}</div>
      <div className="rnx-analytics-grid">
        <section className="supplier-panel"><div className="supplier-section-heading"><div><p className="eyebrow">ACQUISITION</p><h2>Sources</h2></div></div>{data.sources.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Source</th><th>Requests</th><th>Qualified</th><th>Requests later introduced</th><th>Supplier applications</th></tr></thead><tbody>{data.sources.map((row) => <tr key={row.source}><td>{row.source}</td><td>{number(row.leads)}</td><td>{number(row.qualifiedLeads)}</td><td>{number(row.introductions)}</td><td>{number(row.supplierApplications)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No consented acquisition attribution yet. Operational totals above still include all submissions.</p>}</section>
        <section className="supplier-panel"><div className="supplier-section-heading"><div><p className="eyebrow">CAMPAIGN TRACKING</p><h2>Campaigns</h2></div></div>{data.campaigns.length ? <div className="rnx-analytics-bars">{data.campaigns.map((row) => <div className="rnx-analytics-bar-row" key={row.label}><span>{row.label}</span><div><i style={{ width: `${Math.max(4, row.count / Math.max(...data.campaigns.map((item) => item.count)) * 100)}%` }} /></div><strong>{number(row.count)}</strong></div>)}</div> : <p className="admin-empty">No named campaigns captured yet. Use UTM campaign tags in consented links.</p>}</section>
        <section className="supplier-panel"><div className="supplier-section-heading"><div><p className="eyebrow">DEMAND</p><h2>Requested categories</h2></div></div>{data.categories.length ? <div className="rnx-analytics-bars">{data.categories.map((row) => <div className="rnx-analytics-bar-row" key={row.label}><span>{row.label}</span><div><i style={{ width: `${Math.max(4, row.count / Math.max(...data.categories.map((item) => item.count)) * 100)}%` }} /></div><strong>{number(row.count)}</strong></div>)}</div> : <p className="admin-empty">No requests in this period.</p>}</section>
        <section className="supplier-panel"><div className="supplier-section-heading"><div><p className="eyebrow">GEOGRAPHY</p><h2>Request locations</h2></div></div>{data.states.length ? <div className="rnx-analytics-bars">{data.states.map((row) => <div className="rnx-analytics-bar-row" key={row.label}><span>{row.label}</span><div><i style={{ width: `${Math.max(4, row.count / Math.max(...data.states.map((item) => item.count)) * 100)}%` }} /></div><strong>{number(row.count)}</strong></div>)}</div> : <p className="admin-empty">No locations to report.</p>}</section>
      </div>
      <section className="supplier-panel"><div className="supplier-section-heading"><div><p className="eyebrow">DAILY OPERATIONS</p><h2>Submission trend</h2></div></div>{data.daily.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Customer requests</th><th>Supplier applications</th><th>Introductions released</th></tr></thead><tbody>{data.daily.slice(-45).map((row) => <tr key={row.date}><td>{dateLabel(row.date)}</td><td>{number(row.leads)}</td><td>{number(row.suppliers)}</td><td>{number(row.introductions)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No submissions in this period.</p>}</section>
      <section className="supplier-panel rnx-analytics-notes"><h2>Measurement and reporting limits</h2><ul>{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul>{data.capped && <p className="admin-error">At least one data series reached the 5,000-row reporting cap. Totals may be incomplete for this period.</p>}<p className="admin-footnote">Verified lead-fee value includes only offers marked paid with a recorded verification timestamp. It excludes membership fees, refunds after introduction and any other unrecorded revenue. This is an operations report, not audited financial accounting.</p></section>
    </>}
  </section>;
}
