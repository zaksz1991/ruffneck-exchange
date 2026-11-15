 'use client';
import { useState } from 'react';
import { readConsentedAttribution } from '@/lib/analytics-client';
export function RequestForm() {
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [tracking,setTracking]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setBusy(true);setStatus('Submitting your request…');setTracking('');const data={...Object.fromEntries(new FormData(form).entries()),...readConsentedAttribution()};
    try{const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json().catch(()=>({}));if(!response.ok){setStatus(result.error||'The request could not be saved. Please review the details and try again.');return;}form.reset();setStatus('Request received. Save the private link below to follow updates and message RNX Operations.');setTracking(result.trackingUrl||'');}
    catch{setStatus('A network error prevented submission. Check your connection and try again.');}finally{setBusy(false);}}
  return <form className="form-card form-grid" onSubmit={submit}>
    <label>What do you need?<select name="request_type" required defaultValue="product"><option value="product">A product</option><option value="service">A service</option><option value="bulk">Bulk / wholesale supply</option><option value="partnership">Partnership or procurement</option><option value="other">Something else</option></select></label>
    <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>
    <label>Phone / WhatsApp<input name="phone" autoComplete="tel" required minLength={7} maxLength={30}/></label>
    <label>Email address <span className="optional">(optional, used for receipt notifications)</span><input name="email" type="email" autoComplete="email" maxLength={254}/></label>
    <label>State<select name="state" required defaultValue=""><option value="" disabled>Select a state</option>{['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>City / LGA <span className="optional">(optional)</span><input name="city" maxLength={100}/></label>
    <label className="full-field">Product, service or category<input name="category" placeholder="e.g. agricultural processing equipment" required minLength={2} maxLength={100}/></label>
    <label className="full-field">Describe your requirement<textarea name="details" rows={6} required minLength={30} maxLength={4000} placeholder="Include quantity, specifications, budget range or timing where relevant. Do not include sensitive personal information."/></label>
    <label>Preferred contact method<select name="preferred_contact" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option></select></label>
    <label className="check-field full-field"><input type="checkbox" name="consent" value="yes" required/><span>I agree to be contacted about this request. My contact details will not be released to a supplier without a further authorised introduction.</span></label>
    <div className="full-field form-submit"><button className="button" type="submit" disabled={busy}>{busy?'Submitting…':'Submit request — free'}</button><p className="form-status" role="status" aria-live="polite">{status}</p>{tracking&&<div className="tracking-result"><strong>Your private tracking link</strong><a href={tracking}>{tracking}</a><button type="button" className="button button-small button-dark" onClick={()=>void navigator.clipboard?.writeText(tracking)}>Copy private link</button><small>Save this link. Anyone who has it can view and message about this request. It cannot be recovered if lost.</small></div>}</div>
  </form>;
}
