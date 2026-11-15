'use client';

import { useState } from 'react';

export default function Request() {
  const [status, setStatus] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('Submitting…');

    try {
      const data = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(result.error || 'Your request could not be submitted. Please try again.');
        return;
      }

      form.reset();
      setStatus('Request received. Our team will review it and contact you using your selected method.');
    } catch {
      setStatus('A network error prevented submission. Check your connection and try again.');
    }
  }

  return (
    <main className="page">
      <h1>Tell us what you need</h1>
      <p>
        Submitting a request is free. Your contact details are not shared with a
        supplier until the request is qualified, you have been informed, and the
        introduction is authorised.
      </p>
      <form className="form" onSubmit={submit}>
        <label>
          Request type
          <select name="request_type" defaultValue="product">
            <option value="product">Product</option>
            <option value="service">Service</option>
            <option value="bulk">Bulk / wholesale purchase</option>
            <option value="partnership">Partnership</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Your name<input name="name" required minLength={2} maxLength={120} /></label>
        <label>Email<input name="email" type="email" /></label>
        <label>Phone / WhatsApp<input name="phone" required minLength={7} maxLength={30} /></label>
        <label>State<input name="state" required minLength={2} maxLength={60} /></label>
        <label>City / LGA<input name="city" maxLength={100} /></label>
        <label>Category<input name="category" required minLength={2} maxLength={100} /></label>
        <label>
          Describe exactly what you need
          <textarea name="details" minLength={30} maxLength={4000} required />
        </label>
        <label>
          Preferred contact
          <select name="preferred_contact" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone call</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" name="consent" value="yes" required />
          I agree to be contacted about this request and understand that any
          supplier introduction requires my permission.
        </label>
        <button type="submit">Submit request — free</button>
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </main>
  );
}
