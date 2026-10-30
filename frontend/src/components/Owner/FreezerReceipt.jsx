import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {apiFetch} from '../../context/AppContext';
import './freezerReceipt.css';
async function get(url,signal){const response=await apiFetch(url,{signal});const data=await response.json();if(!response.ok)throw Error(data.message||'Unable to load freezer assignments');return data;}
function Table({rows}){return <table><thead><tr>{['S.No','Shop Name','Freezer ID','Freezer Type / Model','Contact'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.shop_id+':'+(r.assignment_id||'legacy')}><td>{i+1}</td><td>{r.shop_name}</td><td>{r.freezer_id||'-'}</td><td>{r.freezer_type||'-'}</td><td>{r.contact||'-'}</td></tr>)}</tbody></table>;}
export function FreezerReceipt(){
 const [routes,setRoutes]=useState([]),[route,setRoute]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[snapshot,setSnapshot]=useState(null);
 const request=useRef(null);
 useEffect(()=>{const c=new AbortController();get('/api/owner/shop-balance-receipt/routes',c.signal).then(setRoutes).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>{c.abort();request.current?.abort();};},[]);
 async function view(routeId){
  request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setData(null);
  try{const result=await get('/api/owner/freezer-receipt/'+routeId,c.signal);if(!c.signal.aborted)setData(result);}
  catch(e){if(e.name!=='AbortError')setError(e.message);}
  finally{if(request.current===c)setBusy(false);}
 }
 useEffect(()=>{
  if(!snapshot)return;
  const finish=()=>setSnapshot(null);
  const media=window.matchMedia('print');let entered=false;
  const changed=e=>{if(e.matches)entered=true;else if(entered)finish();};
  window.addEventListener('afterprint',finish);media.addEventListener('change',changed);
  let cancelled=false;
  const timer=setTimeout(async()=>{
   try{
    await document.fonts.ready;
    if(cancelled)return;
    window.print();
   }catch{setError('Unable to open print dialog.');finish();}
  },150);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('afterprint',finish);media.removeEventListener('change',changed);};
 },[snapshot]);
 return <section className="fr-page"><header><span>OWNER ASSET REPORT</span><h1>Freezer Receipt</h1><p>Route-wise assigned shop freezer details</p></header>
  <div className="fr-results fr-route-list"><div className="fr-result-heading"><h2>Route overview</h2><span>{routes.length} routes</span></div>
   <table><thead><tr><th>S.No</th><th>Route Name</th><th>Action</th></tr></thead><tbody>{routes.map((r,i)=><tr key={r.id}><td>{String(i+1).padStart(2,'0')}</td><td>{r.name}</td><td><button disabled={busy||!!snapshot} onClick={()=>{setRoute(String(r.id));view(r.id);}}>View</button></td></tr>)}</tbody></table>
  </div>
  {!routes.length&&!error&&<p>No eligible routes available.</p>}
  {error&&<p role="alert" className="fr-error">{error}</p>}
  {data&&<article className="fr-results" ref={el=>{if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}}><div className="fr-result-heading"><h2>{data.route.name}</h2><span>{data.rows.length} freezer assignments</span></div>
   {data.rows.length?<><div className="fr-scroll"><Table rows={data.rows}/></div><button onClick={()=>setSnapshot({...data,rows:data.rows.map(r=>({...r})),printedAt:new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata'})})} disabled={!!snapshot}>Print A4</button></>:<p>No freezer-assigned shops in this route.</p>}</article>}
  {snapshot&&createPortal(<article id="freezer-receipt-print"><h1>AVS AGENCIES</h1><h2>Freezer Receipt</h2><div className="fr-print-meta"><strong>Route: {snapshot.route.name}</strong><span>Date: {snapshot.printedAt}</span></div><Table rows={snapshot.rows}/><p>Total freezer assignments: {snapshot.rows.length}</p></article>,document.body)}
 </section>;
}
