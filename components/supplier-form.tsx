'use client';
import { useState } from 'react';
import { readConsentedAttribution } from '@/lib/analytics-client';

export function SupplierForm() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  async function resendVerification() {
    if (!savedEmail) return;
    setResending(true);
    try {
      const response = await fetch('/api/account/email-verification/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'supplier', email: savedEmail }),
      });
      const result = await response.json().catch(() => ({}));
      setStatus(response.ok ? (result.message || 'A new confirmation link has been requested if the application is eligible.') : (result.error || 'A new link could not be requested.'));
    } catch { setStatus('A network error prevented the confirmation request.'); }
    finally { setResending(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setStatus('Submitting business application…'); setSavedEmail(''); setEmailSent(false);
    const data = { ...Object.fromEntries(new FormData(form).entries()), ...readConsentedAttribution() };
    try {
      const response = await fetch('/api/supplier-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(result.error || 'The application could not be saved. Please try again.'); return; }
      const submittedEmail = String(data.email || '').trim().toLowerCase();
      form.reset();
      setSavedEmail(submittedEmail);
      setEmailSent(result.emailVerificationSent === true);
      const listingText = result.listingSubmitted === false
        ? ' Your first listing needs to be resubmitted because it could not be saved.'
        : result.listingSubmitted === true
          ? ' Your first listing is also under review and will not appear publicly until approved.'
          : '';
      setStatus((result.message || 'Your application was received.') + listingText);
    } catch {
      setStatus('A network error prevented submission. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return <form className="form-card form-grid" onSubmit={submit}>
    <label>Business name<input name="business_name" required minLength={2} maxLength={180} /></label>
    <label>Contact person<input name="contact_name" required minLength={2} maxLength={120} /></label>
    <label>Business email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    <label>Supplier portal password<input name="portal_password" type="password" required minLength={10} maxLength={100} autoComplete="new-password" placeholder="At least 10 characters" /><span className="optional">This is stored as a secure password hash. Portal access opens after business approval and email confirmation.</span></label>
    <label>Phone / WhatsApp<input name="phone" required minLength={7} maxLength={30} /></label>
    <label>Business type<select name="business_type" required defaultValue=""><option value="" disabled>Select one</option><option>Manufacturer</option><option>Wholesaler</option><option>Distributor</option><option>Retailer</option><option>Service provider</option><option>Importer / exporter</option><option>Other</option></select></label>
    <label>Main category<input name="category" required minLength={2} maxLength={120} placeholder="e.g. agricultural machinery" /></label>
    <label>Operating state<input name="state" required minLength={2} maxLength={60} placeholder="e.g. Kano" /></label>
    <label>Website <span className="optional">(optional)</span><input name="website" type="url" placeholder="https://" maxLength={300} /></label>
    <label className="full-field">Business description<textarea name="description" rows={4} minLength={30} maxLength={3000} required placeholder="Describe products, services, coverage area and customer types served." /></label>
    <div className="full-field form-section-heading"><span className="eyebrow">OPTIONAL FIRST LISTING</span><h2>Show what your business offers</h2><p>Your first product or service can be reviewed alongside the business application. It will only become visible after both are approved.</p></div>
    <label className="full-field">Product or service title <span className="optional">(optional)</span><input name="first_listing_title" maxLength={180} placeholder="e.g. 5-tonne industrial ice machine" /></label>
    <label>Listing type<select name="first_listing_type" defaultValue="product"><option value="product">Product</option><option value="service">Service</option><option value="wholesale">Wholesale supply</option><option value="rental">Rental</option></select></label>
    <label>Price display<select name="first_listing_price_type" defaultValue="enquiry"><option value="enquiry">Ask for quotation</option><option value="fixed">Fixed price</option><option value="from">Price from</option></select></label>
    <label>Price in NGN <span className="optional">(only for fixed/from price)</span><input name="first_listing_price" inputMode="decimal" placeholder="e.g. 250000" /></label>
    <label className="full-field">Offer description <span className="optional">(required when a title is provided)</span><textarea name="first_listing_description" rows={4} maxLength={3000} placeholder="Describe specifications, use, availability, service coverage and important limitations." /></label>
    <label className="check-field full-field"><input type="checkbox" name="consent" value="yes" required /><span>I confirm that I am authorised to submit this application and consent to RuffNeck Exchange reviewing these business and listing details.</span></label>
    <div className="full-field form-submit">
      <button className="button" type="submit" disabled={busy || resending}>{busy ? 'Submitting…' : 'Submit business application'}</button>
      <p className="form-status" role="status" aria-live="polite">{status}</p>
      {savedEmail && <button className="button button-secondary" type="button" onClick={resendVerification} disabled={busy || resending}>{resending ? 'Requesting link…' : emailSent ? 'Resend email confirmation' : 'Request email confirmation'}</button>}
    </div>
  </form>;
}
