'use client';
import { useCallback,useEffect,useState } from 'react';
type Message={id:string;sender_role:string;sender_name:string;body:string;created_at:string};
type RequestRow={id:string;request_type:string;category:string;state:string;city:string|null;details:string;status:string;contact_release_status:string;created_at:string;last_activity_at:string|null;messages:Message[]};
type Customer={id:string;name:string;email:string};
function date(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'});}
export function CustomerDashboard(){
 const [customer,setCustomer]=useState<Customer|null>(null);const [requests,setRequests]=useState<RequestRow[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState('');const [drafts,setDrafts]=useState<Record<string,string>>({});
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{const [me,res]=await Promise.all([fetch('/api/customer/me',{cache:'no-store'}),fetch('/api/customer/requests',{cache:'no-store'})]);if(me.status===401||res.status===401){window.location.assign('/customer/login');return;}const a=await me.json();const b=await res.json();if(!res.ok)throw new Error(b.error||'Could not load requests.');setCustomer(a.customer);setRequests(b.requests||[]);}catch(e){setError(e instanceof Error?e.message:'Could not load the dashboard.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function logout(){await fetch('/api/customer/logout',{method:'POST'});window.location.assign('/customer/login');}
 async function send(leadId:string){const body=(drafts[leadId]||'').trim();if(body.length<2)return;setBusy(leadId);setError('');try{const res=await fetch('/api/customer/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_id:leadId,body})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Message failed.');setDrafts(v=>({...v,[leadId]:''}));await refresh();}catch(e){setError(e instanceof Error?e.message:'Message failed.');}finally{setBusy('');}}
 return <div className="customer-dashboard">
  <div className="customer-toolbar"><div><p className="eyebrow">CUSTOMER ACCOUNT</p><h2>{customer?`Welcome, ${customer.name}`:'Your requests'}</h2><p>{customer?.email}</p></div><div className="customer-toolbar-actions"><button className="button button-small button-dark" onClick={()=>void refresh()} disabled={loading}>Refresh</button><button className="button button-small" onClick={()=>void logout()}>Sign out</button></div></div>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {loading?<div className="admin-empty">Loading your requests…</div>:requests.length===0?<div className="empty-state"><h3>No account-linked requests yet</h3><p>When you submit a request while signed in, it will appear here. Guest requests can still be followed through their private tracking links.</p><a className="button" href="/request">Submit a request</a></div>:requests.map(item=><article className="customer-request-card" key={item.id}>
   <div className="customer-request-heading"><div><span className="eyebrow">{item.request_type.replace('_',' ')}</span><h3>{item.category}</h3><p>{[item.city,item.state].filter(Boolean).join(', ')} · Submitted {date(item.created_at)}</p></div><span className={`customer-status status-${item.status}`}>{item.status.replace('_',' ')}</span></div>
   <p className="customer-request-details">{item.details}</p><div className="customer-request-meta"><span>Contact release: {item.contact_release_status}</span><span>Last activity: {date(item.last_activity_at||item.created_at)}</span></div>
   <div className="customer-thread"><h4>Conversation with RNX</h4>{item.messages.length?item.messages.map(m=><div className={`customer-message ${m.sender_role==='operations'?'is-operations':'is-customer'}`} key={m.id}><div><strong>{m.sender_name}</strong><small>{date(m.created_at)}</small></div><p>{m.body}</p></div>):<p className="fine-print">No messages yet. Send a message to ask for an update or clarify your request.</p>}
    <div className="customer-compose"><textarea rows={3} maxLength={3000} value={drafts[item.id]||''} onChange={e=>setDrafts(v=>({...v,[item.id]:e.target.value}))} placeholder="Message RNX Operations…"/><button className="button button-small" disabled={busy===item.id||(drafts[item.id]||'').trim().length<2} onClick={()=>void send(item.id)}>{busy===item.id?'Sending…':'Send message'}</button></div>
   </div>
  </article>)}
 </div>;
}
