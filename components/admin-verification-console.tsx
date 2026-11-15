'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Row = { id:string; supplier_application_id:string; verification_type:string; registered_business_name:string; registration_number:string|null; country:string; operating_state:string; status:string; submitted_at:string|null; reviewed_at:string|null; verification_expires_at:string|null; created_at:string; document_count:number; supplier:{business_name:string;email:string;phone:string;status:string;category:string;state:string}|Array<{business_name:string;email:string;phone:string;status:string;category:string;state:string}> };
type Doc = { id:string; document_type:string; original_file_name:string; mime_type:string; file_size_bytes:number; review_status:'uploaded'|'accepted'|'rejected'; review_note:string|null; signedUrl:string|null; created_at:string };
type Detail = { verification: Row & { website:string|null; supplier_statement:string; supplier_message:string|null; internal_review_note:string|null; supplier:Row['supplier'] }; documents:Doc[]; events:Array<{id:string;actor_role:string;actor_email:string|null;event_type:string;details:Record<string,unknown>;created_at:string}> };
const states=['under_review','verified','rejected','expired'];
const labels=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const date=(v?:string|null)=>v?new Date(v).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'}):'—';
const docLabel=(v:string)=>labels(v);
function supplierOf(value:Row['supplier']) { return Array.isArray(value)?value[0]:value; }

export function AdminVerificationConsole({canWrite}:{canWrite:boolean}) {
  const [rows,setRows]=useState<Row[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [filter,setFilter]=useState('submitted');
  const [status,setStatus]=useState('under_review');
  const [expiry,setExpiry]=useState('');
  const [supplierMessage,setSupplierMessage]=useState('');
  const [internalNote,setInternalNote]=useState('');
  const [docStates,setDocStates]=useState<Record<string,{status:'uploaded'|'accepted'|'rejected';note:string}>>({});
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{const response=await fetch('/api/admin/supplier-verifications',{cache:'no-store'});const data=await response.json().catch(()=>({}));if(response.status===401){window.location.assign('/admin/login');return;}if(!response.ok)throw new Error(data.error||'Queue could not be loaded.');setRows(data.verifications||[]);}
    catch(err){setError(err instanceof Error?err.message:'Queue could not be loaded.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

  const loadDetail=useCallback(async(id:string)=>{
    setError('');
    try{const response=await fetch(`/api/admin/supplier-verifications/${id}`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Verification details could not be loaded.');const next=data as Detail;setDetail(next);setStatus(next.verification.status==='submitted'?'under_review':next.verification.status);setSupplierMessage(next.verification.supplier_message||'');setInternalNote(next.verification.internal_review_note||'');setExpiry(next.verification.verification_expires_at?new Date(next.verification.verification_expires_at).toISOString().slice(0,10):'');setDocStates(Object.fromEntries(next.documents.map(d=>[d.id,{status:d.review_status,note:d.review_note||''}])));}
    catch(err){setError(err instanceof Error?err.message:'Verification details could not be loaded.');}
  },[]);

  const visible=useMemo(()=>rows.filter(row=>filter==='all'||row.status===filter),[rows,filter]);

  async function saveReview(){if(!detail||!canWrite)return;setBusy(true);setError('');setNotice('');
    try{const response=await fetch(`/api/admin/supplier-verifications/${detail.verification.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,supplierMessage,internalReviewNote:internalNote,verificationExpiresAt:expiry?new Date(`${expiry}T23:59:59.000Z`).toISOString():'',documentReviews:['submitted','under_review'].includes(detail.verification.status)?detail.documents.map(doc=>({doc,state:docStates[doc.id]?.status||doc.review_status})).filter(item=>item.state==='accepted'||item.state==='rejected').map(({doc,state})=>({id:doc.id,status:(state==='accepted'?'accepted':'rejected') as 'accepted'|'rejected',note:docStates[doc.id]?.note||''})):[]})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Review could not be saved.');setNotice(data.message||'Review saved.');await refresh();await loadDetail(detail.verification.id);}
    catch(err){setError(err instanceof Error?err.message:'Review could not be saved.');}
    finally{setBusy(false);}
  }

  return <div className="admin-verification-console">
    <div className="supplier-dashboard-toolbar"><div><p className="eyebrow">SUPPLIER ASSURANCE</p><h2>Verification queue</h2><p>Review business declarations and private evidence. Verification is time-limited and does not guarantee goods, licences, stock or quality.</p></div><button className="button button-small" type="button" disabled={loading} onClick={()=>void refresh()}>Refresh queue</button></div>
    {notice&&<p className="admin-notice" role="status">{notice}</p>}{error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="admin-verification-layout">
      <section className="supplier-panel admin-verification-list"><div className="supplier-section-heading"><div><p className="eyebrow">SUBMISSIONS</p><h2>{visible.length} records</h2></div><label>Filter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="all">All records</option></select></label></div>
        {loading?<p className="admin-empty">Loading verification submissions…</p>:visible.length===0?<p className="admin-empty">No records in this view.</p>:<div className="admin-verification-items">{visible.map(row=>{const supplier=supplierOf(row.supplier);return <button type="button" key={row.id} className={`admin-verification-item ${detail?.verification.id===row.id?'is-selected':''}`} onClick={()=>void loadDetail(row.id)}><div><strong>{supplier?.business_name||row.registered_business_name}</strong><span className={`admin-state-${row.status==='verified'?'good':row.status==='rejected'||row.status==='expired'?'bad':'wait'}`}>{labels(row.status)}</span></div><p>{row.verification_type.replaceAll('_',' ')} · {supplier?.state||row.operating_state}</p><small>{row.document_count} evidence files · Submitted {date(row.submitted_at)}</small></button>;})}</div>}
      </section>
      <section className="supplier-panel admin-verification-detail"><div className="supplier-section-heading"><div><p className="eyebrow">REVIEW WORKSPACE</p><h2>{detail?.verification.registered_business_name||'Select a submission'}</h2></div>{detail&&<span className="customer-status">{labels(detail.verification.status)}</span>}</div>
        {!detail?<p className="admin-empty">Select a supplier submission to review its declarations, documents and decision history.</p>:<>
          {(()=>{const supplier=supplierOf(detail.verification.supplier);return <div className="admin-verification-supplier"><strong>{supplier?.business_name}</strong><span>{supplier?.email} · {supplier?.phone}</span><small>{supplier?.category} · {supplier?.state} · Marketplace supplier status: {supplier?.status}</small>{detail.verification.website&&<a href={detail.verification.website} target="_blank" rel="noreferrer">Visit declared website ↗</a>}</div>;})()}
          <dl className="admin-verification-facts"><div><dt>Legal / registered name</dt><dd>{detail.verification.registered_business_name}</dd></div><div><dt>Registration number</dt><dd>{detail.verification.registration_number||'Not supplied'}</dd></div><div><dt>Business structure</dt><dd>{labels(detail.verification.verification_type)}</dd></div><div><dt>Country / state</dt><dd>{detail.verification.country} · {detail.verification.operating_state}</dd></div></dl>
          <div className="admin-verification-statement"><span className="eyebrow">SUPPLIER DECLARATION</span><p>{detail.verification.supplier_statement}</p></div>
          <div className="admin-verification-documents"><h3>Private evidence</h3>{detail.documents.map(doc=><article key={doc.id}><div><strong>{docLabel(doc.document_type)}</strong><span>{doc.original_file_name} · {(doc.file_size_bytes/1048576).toFixed(1)} MB · {doc.mime_type}</span>{doc.review_note&&<small>Previous note: {doc.review_note}</small>}</div>{doc.signedUrl&&<a href={doc.signedUrl} target="_blank" rel="noreferrer">Open (5 min link)</a>}<label>Review<select disabled={!canWrite||!['submitted','under_review'].includes(detail.verification.status)} value={docStates[doc.id]?.status||'rejected'} onChange={e=>setDocStates(prev=>({...prev,[doc.id]:{status:e.target.value as 'uploaded'|'accepted'|'rejected',note:prev[doc.id]?.note||''}}))}><option value="uploaded">Pending review</option><option value="accepted">Accept</option><option value="rejected">Reject / not accepted</option></select></label><input disabled={!canWrite||!['submitted','under_review'].includes(detail.verification.status)} aria-label="Document review note" placeholder="Document-specific note (optional)" value={docStates[doc.id]?.note||''} onChange={e=>setDocStates(prev=>({...prev,[doc.id]:{status:prev[doc.id]?.status||'uploaded',note:e.target.value}}))}/></article>)}</div>
          <div className="admin-verification-review"><h3>Review decision</h3><label>Status<select disabled={!canWrite} value={status} onChange={e=>setStatus(e.target.value)}>{states.map(v=><option key={v} value={v}>{labels(v)}</option>)}</select></label>{status==='verified'&&<label>Verification expires<input disabled={!canWrite} type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} /></label>}<label>Supplier-visible message<textarea disabled={!canWrite} rows={3} maxLength={1800} value={supplierMessage} onChange={e=>setSupplierMessage(e.target.value)} placeholder="Explain the decision or request a correction. This is visible to the supplier." /></label><label>Private internal review note<textarea disabled={!canWrite} rows={3} maxLength={3000} value={internalNote} onChange={e=>setInternalNote(e.target.value)} placeholder="Staff-only notes. Never visible to the supplier." /></label>{canWrite&&<button className="button" type="button" disabled={busy} onClick={()=>void saveReview()}>{busy?'Saving review…':'Save verification decision'}</button>}<p className="admin-footnote">Approval is a limited RNX documentary review for the stated business identity and evidence. It is not a regulatory certification, a guarantee of solvency, quality, stock or legal compliance. Record only supportable conclusions.</p></div>
          <div className="admin-verification-events"><h3>Review history</h3>{detail.events.map(event=><p key={event.id}><strong>{labels(event.event_type)}</strong><span>{event.actor_email||event.actor_role} · {date(event.created_at)}</span></p>)}</div>
        </>}
      </section>
    </div>
  </div>;
}
