'use client';

import { useState } from 'react';

export default function Register() {
  const [status, setStatus] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('Submitting…');

    try {
      const data = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/supplier-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(result.error || 'Your application could not be submitted. Please try again.');
        return;
      }

      form.reset();
      setStatus('Application received. It will be reviewed before publication.');
    } catch {
      setStatus('A network error prevented submission. Check your connection and try again.');
    }
  }

  return (
    <main className="page">
      <h1>Register your business</h1>
      <p>
        Apply as a manufacturer, wholesaler, distributor, product seller,
        contractor or service provider.
      </p>
      <form className="form" onSubmit={submit}>
        <label>Business name<input name="business_name" required minLength={2} maxLength={150} /></label>
        <label>Contact person<input name="contact_name" required minLength={2} maxLength={120} /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Phone / WhatsApp<input name="phone" required minLength={7} maxLength={30} /></label>
        <label>
          Business type
          <select name="business_type" defaultValue="Product seller">
            <option>Product seller</option>
            <option>Manufacturer</option>
            <option>Wholesaler / distributor</option>
            <option>Service provider</option>
            <option>Multiple</option>
          </select>
        </label>
        <label>Primary category<input name="category" required minLength={2} maxLength={100} /></label>
        <label>State<input name="state" required minLength={2} maxLength={60} /></label>
        <label>Website or social profile<input name="website" maxLength={300} /></label>
        <label>
          What do you sell or provide?
          <textarea name="description" required minLength={30} maxLength={3000} />
        </label>
        <label className="check">
          <input type="checkbox" name="consent" value="yes" required />
          I agree that RNX may contact me about this application and review my
          submitted business information.
        </label>
        <button type="submit">Submit application</button>
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </main>
  );
}
