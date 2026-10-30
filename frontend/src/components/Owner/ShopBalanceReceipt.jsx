import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {apiFetch} from '../../context/AppContext';
import './shopBalanceReceipt.css';
const base='/api/owner/shop-balance-receipt';
export function money(value) {
 const [whole,fraction='']=String(value||'0').split('.');
 return '₹'+BigInt(whole).toLocaleString('en-IN')+'.'+fraction.padEnd(2,'0').slice(0,2);
}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
async function get(url,signal) {
 const response=await apiFetch(url,{signal});const data=await response.json();
 if(!response.ok)throw new Error(data.message||'Unable to load receipt');
 return data;
}
export function displayDate(value) {
 return /^\d{4}-\d{2}-\d{2}$/.test(value||'') ? value.split('-').reverse().join('-') : value;
}
function Rows({rows,thermal=false}) {
 return rows.map(row=><tr key={row.date||'opening'}><td>{displayDate(row.date)||'Opening Balance'}</td><td>{row.milk}</td><td>{row.curd}</td><td>{money(row.balance)}</td></tr>);
}
export function ShopBalanceReceipt() {
 const [routes,setRoutes]=useState([]),[shops,setShops]=useState([]);
 const [route,setRoute]=useState(''),[shop,setShop]=useState('');
 const [from,setFrom]=useState(''),[to,setTo]=useState('');
 const [applied,setApplied]=useState({from:'',to:''});
 const [result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[shopsLoading,setShopsLoading]=useState(false);
 const [snapshot,setSnapshot]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();
  get(base+'/routes',controller.signal).then(setRoutes).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();let live=true;
  setShops([]);setResult(null);
  if(!route)return()=>controller.abort();
  setShopsLoading(true);
  get(base+'/routes/'+route+'/shops',controller.signal).then(rows=>{if(live)setShops(rows);}).catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(live)setShopsLoading(false);});
  return()=>{live=false;controller.abort();};
 },[route]);
 useEffect(()=>{
  const controller=new AbortController();let live=true;
  setResult(null);setError('');setLoading(false);
  if(!shop||!route)return()=>controller.abort();
  if(applied.from&&applied.to&&applied.from>applied.to){setError('From Date must be on or before To Date.');return()=>controller.abort();}
  setLoading(true);
  get(base+'/details?'+new URLSearchParams({routeId:route,shopId:shop,from:applied.from,to:applied.to}),controller.signal)
   .then(data=>{if(live)setResult(data);}).catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;controller.abort();};
 },[route,shop,applied]);
 useEffect(()=>{
  if(!snapshot)return;
  let finished=false;
  const finish=()=>{if(!finished){finished=true;setSnapshot(null);}};
  const media=window.matchMedia('print');
  const changed=e=>{if(!e.matches)finish();};
  window.addEventListener('afterprint',finish);media.addEventListener('change',changed);
  const timer=setTimeout(()=>{try{window.print();}catch{setError('Unable to open print dialog.');finish();}},150);
  return()=>{clearTimeout(timer);window.removeEventListener('afterprint',finish);media.removeEventListener('change',changed);};
 },[snapshot]);
 const clear=()=>setResult(null);
 return <section className="sbr-page">
  <header><span className="sbr-eyebrow">OWNER COLLECTION REPORT</span><h1>Shop Balance Receipt</h1><p>Date-wise outstanding balances · Milk and Curd in pieces</p></header>
  <div className="sbr-controls">
   <label className="sbr-selector">Route Name<select value={route} disabled={!!snapshot} onChange={e=>{setRoute(e.target.value);setShop('');setShops([]);clear();}}><option value="">Select route</option>{routes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label className="sbr-selector">Shop Name<select value={shop} disabled={!route||shopsLoading||!!snapshot} onChange={e=>{setShop(e.target.value);clear();}}><option value="">{shopsLoading?'Loading shops…':'Select shop'}</option>{shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  </div>
  {!routes.length&&!error&&<p>No eligible routes available.</p>}
  {route&&!shopsLoading&&!shops.length&&<p>No active shops in this route.</p>}
  {shop&&<div className="sbr-filter-bar" aria-label="Date filters">
   <span className="sbr-filter-title">Billing transactions</span>
   <div className="sbr-date-controls">
   <label>From Date<input type="date" value={from} disabled={!!snapshot} onChange={e=>{setFrom(e.target.value);}}/></label>
   <label>To Date<input type="date" value={to} disabled={!!snapshot} onChange={e=>{setTo(e.target.value);}}/></label>
   <button className="sbr-submit" disabled={!shop||!!snapshot} onClick={()=>{
    if((from&&!to)||(!from&&to)||from>to){setError('Select both dates, with From Date on or before To Date.');return;}
    setError('');clear();setApplied({from,to});
   }}>Submit</button>
   </div>
  </div>}
  {error&&<p role="alert" className="sbr-error">{error}</p>}
  {loading&&<p role="status">Loading shop transactions…</p>}
  {result&&<div className="sbr-results"><h2>{result.name}</h2>
   <div className="sbr-scroll"><table><thead><tr><th>Billing Date</th><th>Milk (pcs)</th><th>Curd (pcs)</th><th>Balance</th></tr></thead><tbody><Rows rows={result.rows}/></tbody></table></div>
   {!result.rows.length&&<p>No billing transactions in this date range.</p>}
   <p className="sbr-total">Total Balance: {money(result.total)}</p>
   <button disabled={!!snapshot||loading||!result.rows.length} onClick={()=>{if(route&&shop)setSnapshot({...result,rows:result.rows.map(r=>({...r})),printedAt:today()});}}>Print</button>
  </div>}
  {snapshot&&createPortal(<article id="shop-balance-receipt"><h1>AVS AGENCIES</h1><div className="sbr-print-meta"><strong>{snapshot.name}</strong><span>{displayDate(snapshot.printedAt)}</span></div>
   <table><thead><tr><th>Date</th><th>M</th><th>C</th><th>Bal</th></tr></thead><tbody><Rows rows={snapshot.rows} thermal/></tbody></table>
   <p className="sbr-print-total">TOTAL BAL: {money(snapshot.total)}</p>
  </article>,document.body)}
 </section>;
}
