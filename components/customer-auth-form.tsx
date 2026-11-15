'use client';
import { useState } from 'react';

export function CustomerAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form=event.currentTarget; const data=Object.fromEntries(new FormData(form).entries());
    try { const response=await fetch(`/api/customer/${mode==='register'?'register':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const result=await response.json().catch(()=>({})); if(!response.ok) throw new Error(result.error||'Sign-in failed.'); window.location.assign('/customer/dashboard'); }
    catch(err){setError(err instanceof Error?err.message:'A network error occurred.');} finally{setBusy(false);}
  }
  return <form className="form-card customer-auth-form" onSubmit={submit}>
    {mode==='register'&&<label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    {mode==='register'&&<label>Phone / WhatsApp<input name="phone" autoComplete="tel" required minLength={7} maxLength={30}/></label>}
    <label>Password<input name="password" type="password" autoComplete={mode==='register'?'new-password':'current-password'} required minLength={mode==='register'?10:1} maxLength={100}/>{mode==='register'&&<small>Use at least 10 characters. Do not reuse a password from another service.</small>}</label>
    <button className="button" type="submit" disabled={busy}>{busy?(mode==='register'?'Creating account…':'Signing in…'):(mode==='register'?'Create customer account':'Sign in')}</button>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <p className="fine-print">Customer account email addresses are not independently verified in this release. Do not use an email address you do not control.</p>
  </form>;
}
