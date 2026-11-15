'use client';

import { useState } from 'react';

export function SupplierForm() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setStatus('Submitting business application…');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch('/api/supplier-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(result.error || 'The application could not be saved. Please try again.');
        return;
      }
      form.reset();
      setStatus('Application received. It will be reviewed before your business is represented as approved.');
    } catch {
      setStatus('A network error prevented submission. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card form-grid" onSubmit={submit}>
      <label>Business name<input name="business_name" required minLength={2} maxLength={180} /></label>
      <label>Contact person<input name="contact_name" required minLength={2} maxLength={120} /></label>
      <label>Business email<input name="email" type="email" required maxLength={254} /></label>
      <label>Phone / WhatsApp<input name="phone" required minLength={7} maxLength={30} /></label>
      <label>Business type<select name="business_type" required defaultValue=""><option value="" disabled>Select one</option><option>Manufacturer</option><option>Wholesaler</option><option>Distributor</option><option>Retailer</option><option>Service provider</option><option>Importer / exporter</option><option>Other</option></select></label>
      <label>Main category<input name="category" required minLength={2} maxLength={120} /></label>
      <label>Operating state<input name="state" required minLength={2} maxLength={60} /></label>
      <label>Website <span className="optional">(optional)</span><input name="website" type="url" placeholder="https://" maxLength={300} /></label>
      <label className="full-field">Business description<textarea name="description" rows={5} minLength={30} maxLength={3000} required placeholder="Describe products, services, coverage area and customer types served." /></label>
      <label className="check-field full-field"><input type="checkbox" name="consent" value="yes" required /><span>I confirm that I am authorised to submit this application and consent to RuffNeck Exchange reviewing these business details.</span></label>
      <div className="full-field form-submit"><button className="button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit business application'}</button><p className="form-status" role="status" aria-live="polite">{status}</p></div>
    </form>
  );
}
