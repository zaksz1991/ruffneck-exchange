'use client';
import { useCallback, useEffect, useState } from 'react';

type VerificationDoc = { id: string; document_type: string; original_file_name: string; mime_type: string; file_size_bytes: number; review_status: string; signedUrl: string | null; created_at: string };
type VerificationRequest = { id: string; verification_type: string; registered_business_name: string; registration_number: string | null; country: string; operating_state: string; website: string | null; supplier_statement: string; status: string; supplier_message: string | null; submitted_at: string | null; reviewed_at: string | null; verification_expires_at: string | null };
type Payload = { request: VerificationRequest | null; documents: VerificationDoc[]; supplierVerificationStatus: string };
const docTypes = [
  ['business_registration','Business registration / incorporation certificate'],
  ['proof_of_address','Business address evidence'],
  ['operating_license','Relevant operating or professional licence'],
  ['business_evidence','Evidence of active business operations'],
  ['authority_letter','Evidence of authority to represent the business'],
  ['tax_registration','Tax registration evidence (optional)'],
  ['other','Other supporting evidence'],
] as const;
const statusLabel = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, (m) => m.toUpperCase());
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—';
const sizeLabel = (value: number) => value < 1024 * 1024 ? `${Math.max(1,Math.round(value/1024))} KB` : `${(value/1024/1024).toFixed(1)} MB`;

export function SupplierVerificationPanel() {
  const [data,setData] = useState<Payload | null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [verificationType,setVerificationType] = useState('registered_business');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/supplier/verification',{cache:'no-store'});
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Verification details could not be loaded.');
      const next = result as Payload; setData(next);
      if (next.request) setVerificationType(next.request.verification_type);
    } catch (err) { setError(err instanceof Error ? err.message : 'Verification details could not be loaded.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    const payload = {
      verificationType: form.get('verificationType'), registeredBusinessName: form.get('registeredBusinessName'),
      registrationNumber: form.get('registrationNumber'), country: form.get('country'), operatingState: form.get('operatingState'),
      website: form.get('website'), supplierStatement: form.get('supplierStatement'), declarationAccepted: form.get('declarationAccepted') === 'yes',
    };
    try {
      const response = await fetch('/api/supplier/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json().catch(()=>({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Verification draft could not be saved.');
      setNotice(result.message || 'Verification draft saved.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Verification draft could not be saved.'); }
    finally { setBusy(false); }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data?.request) return; setBusy(true); setError(''); setNotice('');
    const formElement = event.currentTarget; const form = new FormData(formElement); form.set('verificationId',data.request.id);
    try {
      const response = await fetch('/api/supplier/verification/documents',{method:'POST',body:form});
      const result = await response.json().catch(()=>({}));
      if (response.status === 401) { window.location.assign('/supplier/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Evidence upload failed.');
      formElement.reset(); setNotice(result.message || 'Evidence uploaded.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Evidence upload failed.'); }
    finally { setBusy(false); }
  }

  async function removeDocument(documentId:string) {
    if (!window.confirm('Remove this evidence file from the draft?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/supplier/verification/documents',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Evidence could not be removed.');
      setNotice('Evidence removed.'); await refresh();
    } catch(err) { setError(err instanceof Error ? err.message : 'Evidence could not be removed.'); }
    finally { setBusy(false); }
  }

  async function submitVerification() {
    if (!data?.request) return;
    if (!window.confirm('Submit this verification and its evidence for RNX review? You will no longer be able to change uploaded files while it is under review.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/supplier/verification/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verificationId:data.request.id})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Verification could not be submitted.');
      setNotice(result.message || 'Verification submitted.'); await refresh();
    } catch(err) { setError(err instanceof Error ? err.message : 'Verification could not be submitted.'); }
    finally { setBusy(false); }
  }

  const request = data?.request;
  const editable = request?.status === 'draft';
  const requirements = request?.verification_type === 'licensed_provider' ? ['business_registration','operating_license','proof_of_address'] : request?.verification_type === 'sole_trader' ? ['business_evidence','proof_of_address'] : ['business_registration','proof_of_address'];
  const present = new Set((data?.documents || []).map((doc)=>doc.document_type));
  const missing = requirements.filter((type)=>!present.has(type));

  return <section className="supplier-panel rnx-verification-panel">
    <div className="supplier-section-heading"><div><p className="eyebrow">BUSINESS ASSURANCE</p><h2>Business verification</h2><p>Submit business evidence for a separate RNX review. Approval is not a guarantee of product quality, stock, licensing or legal compliance.</p></div><span className={`admin-state-${data?.supplierVerificationStatus === 'verified' ? 'good' : data?.supplierVerificationStatus === 'rejected' ? 'bad' : 'wait'}`}>{statusLabel(data?.supplierVerificationStatus || 'unverified')}</span></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {loading && !data ? <p className="admin-empty">Loading verification record…</p> : !request || ['draft','rejected','expired'].includes(request.status) ? <>
      {request?.status === 'rejected' && <div className="verification-feedback"><strong>Previous review outcome</strong><p>{request.supplier_message || 'The submission was not approved. Review your evidence before starting again.'}</p></div>}
      {request?.status === 'expired' && <div className="verification-feedback"><strong>Verification expired</strong><p>Submit current supporting evidence for a new review.</p></div>}
      <form className="supplier-verification-form" onSubmit={(event)=>void saveDraft(event)}>
        <label>Business structure<select name="verificationType" value={verificationType} onChange={(event)=>setVerificationType(event.target.value)}><option value="registered_business">Registered company / business</option><option value="sole_trader">Sole trader / unincorporated business</option><option value="licensed_provider">Licensed or regulated provider</option></select></label>
        <label>Registered business name<input name="registeredBusinessName" required minLength={2} maxLength={180} defaultValue={request?.registered_business_name || ''} /></label>
        <label>Registration number <span className="optional">(where applicable)</span><input name="registrationNumber" maxLength={80} defaultValue={request?.registration_number || ''} /></label>
        <label>Country<input name="country" required maxLength={80} defaultValue={request?.country || 'Nigeria'} /></label>
        <label>Operating state<input name="operatingState" required maxLength={80} defaultValue={request?.operating_state || ''} /></label>
        <label>Business website <span className="optional">(optional)</span><input name="website" type="url" maxLength={300} placeholder="https://" defaultValue={request?.website || ''} /></label>
        <label className="full-field">Business explanation<textarea name="supplierStatement" minLength={20} maxLength={1800} rows={3} required defaultValue={request?.supplier_statement || ''} placeholder="Describe the business activity and the authority under which the person submitting this verification represents the business." /></label>
        <label className="check-field full-field"><input type="checkbox" name="declarationAccepted" value="yes" required defaultChecked={false} /><span>I confirm that these details and documents are accurate, current and submitted with authority. I authorise RNX to review them for supplier assurance purposes.</span></label>
        <div className="full-field"><button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save verification draft'}</button></div>
      </form>
    </> : <>
      <div className="verification-summary"><div><span>Submission status</span><strong>{statusLabel(request.status)}</strong></div><div><span>Submitted</span><strong>{dateLabel(request.submitted_at)}</strong></div><div><span>Verification expiry</span><strong>{dateLabel(request.verification_expires_at)}</strong></div></div>
      <p className="verification-feedback"><strong>{request.supplier_message || 'Your submission is in the RNX review queue.'}</strong></p>
      <div className="verification-details"><span>{request.registered_business_name}</span><span>{request.verification_type.replaceAll('_',' ')} · {request.country} · {request.operating_state}</span>{request.registration_number && <span>Registration number: {request.registration_number}</span>}</div>
    </>}
    {request?.status === 'draft' && <>
      <form className="verification-upload-form" onSubmit={(event)=>void uploadDocument(event)}>
        <label>Evidence category<select name="documentType" required>{docTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>PDF or image file<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
        <small>PDF, JPEG, PNG or WebP. Maximum 4 MB per file; maximum 10 files. Files are stored in a private bucket.</small>
        <button className="button button-small" type="submit" disabled={busy}>Upload evidence</button>
      </form>
      <div className="verification-doc-list">{data?.documents.map((doc)=><article key={doc.id}><div><strong>{docTypes.find(([value])=>value===doc.document_type)?.[1] || statusLabel(doc.document_type)}</strong><span>{doc.original_file_name} · {sizeLabel(doc.file_size_bytes)} · {statusLabel(doc.review_status)}</span></div><div>{doc.signedUrl && <a className="text-link" href={doc.signedUrl} target="_blank" rel="noreferrer">View</a>}<button className="text-button" type="button" disabled={busy} onClick={()=>void removeDocument(doc.id)}>Remove</button></div></article>)}</div>
      <div className="verification-submit-row"><span>{missing.length ? `Still required: ${missing.map((v)=>statusLabel(v)).join(', ')}` : `${data?.documents.length || 0} evidence files uploaded.`}</span><button className="button" type="button" disabled={busy || missing.length > 0} onClick={()=>void submitVerification()}>Submit for RNX review</button></div>
    </>}
    {request && !editable && data?.documents.length ? <div className="verification-doc-list">{data.documents.map((doc)=><article key={doc.id}><div><strong>{docTypes.find(([value])=>value===doc.document_type)?.[1] || statusLabel(doc.document_type)}</strong><span>{doc.original_file_name} · {sizeLabel(doc.file_size_bytes)} · {statusLabel(doc.review_status)}</span></div>{doc.signedUrl && <a className="text-link" href={doc.signedUrl} target="_blank" rel="noreferrer">View</a>}</article>)}</div> : null}
    <p className="admin-footnote">Evidence documents are private. Only the submitting supplier and authorised RNX verification staff can obtain temporary viewing links. RNX review is not a substitute for independent regulatory, legal or product checks.</p>
    <button className="text-button" type="button" onClick={()=>void refresh()} disabled={busy || loading}>Refresh verification status</button>
  </section>;
}
