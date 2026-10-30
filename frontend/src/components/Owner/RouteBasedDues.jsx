import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { MapPin, ArrowUpRight, Wallet, CircleCheck, UserRound } from 'lucide-react';
import { apiFetch } from '../../context/AppContext';
import './routeBasedDues.css';

// Format PostgreSQL decimal strings without converting money to floating point.
export function duesCurrency(value) {
 const [whole,fraction='']=String(value).split('.');
 return `₹${BigInt(whole).toLocaleString('en-IN')}.${fraction.padEnd(2,'0').slice(0,2)}`;
}
const endpoint='/api/owner/route-dues';
async function load(url) {
 const response=await apiFetch(url);
 if(!response.ok) throw new Error('Unable to load route dues. Please retry.');
 return response.json();
}
function ShopRows({shops}) {
 return shops.map((shop,index)=><tr key={shop.id}><td>{index+1}</td><td>{shop.name}</td><td className="dues-money">{duesCurrency(shop.balance)}</td></tr>);
}
export function RouteBasedDues() {
 const [routes,setRoutes]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[printSnapshot,setPrintSnapshot]=useState(null);
 const locked=useRef(false),printing=useRef(false),alive=useRef(true);
 async function refresh() {
  setLoading(true);setError('');
  try { const data=await load(endpoint);if(alive.current)setRoutes(data); }
  catch(e) {if(alive.current)setError(e.message);}
  finally {if(alive.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;refresh();return()=>{alive.current=false;};},[]);
 async function view(id) {
  if(locked.current)return;
  locked.current=true;setBusy(true);
  try {
   const detail=await load(`${endpoint}/${id}`);
   if(!alive.current)return;
   setRoutes(old=>old.map(row=>row.id===detail.id?detail:row));
   if(!detail.shops.length) {toast.info('No pending due shops');return;}
   setSelected(detail);
  } catch(e) {if(alive.current)toast.error(e.message);}
  finally {locked.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!printSnapshot)return;
  let finished=false,enteredPrint=false,started=false;
  const media=window.matchMedia('print');
  const cleanup=()=>{
   window.removeEventListener('afterprint',finish);
   window.removeEventListener('beforeprint',before);
   media.removeEventListener('change',mediaChanged);
  };
  const finish=()=>{
   if(finished || !started)return;
   finished=true;cleanup();printing.current=false;
   setPrintSnapshot(null);setSelected(null);refresh();
  };
  const before=()=>{enteredPrint=true;};
  const mediaChanged=event=>{
   if(event.matches)enteredPrint=true;
   else if(enteredPrint)finish();
  };
  window.addEventListener('afterprint',finish);
  window.addEventListener('beforeprint',before);
  media.addEventListener('change',mediaChanged);
  const timer=setTimeout(()=>{
   started=true;
   try {
    const receipt=document.getElementById('route-dues-receipt');
    // Measure with the actual thermal print styles before opening the dialog.
    const frame=document.createElement('iframe');
    frame.style.cssText='position:fixed;left:-10000px;width:52mm;height:1px;border:0';
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head></head><body></body></html>');
    doc.close();
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node=>doc.head.appendChild(node.cloneNode(true)));
    const copy=receipt.cloneNode(true);
    doc.body.appendChild(copy);
    const measureStyle=doc.createElement('style');
    measureStyle.textContent=`
     body {margin:0;padding:0;}
     #route-dues-receipt {display:block!important;width:48mm!important;font:11px/1.45 Arial,sans-serif;}
    `;
    // Apply print rules to the measuring document as screen rules.
    for(const sheet of document.styleSheets) {
     try { for(const rule of sheet.cssRules) {
      if(rule.conditionText==='print') {
       const style=doc.createElement('style');
       style.textContent=Array.from(rule.cssRules).filter(r=>!r.cssText.startsWith('@page')).map(r=>r.cssText).join('\n');
       doc.head.appendChild(style);
      }
     }} catch { /* External styles are already linked above. */ }
    }
    doc.head.appendChild(measureStyle);
    const heightMm=Math.ceil(copy.getBoundingClientRect().height*25.4/96)+8;
    frame.remove();
    const pageStyle=document.createElement('style');
    pageStyle.textContent=`@media print {@page route-dues {size:52mm ${Math.max(30,heightMm)}mm;margin:2mm;}}`;
    document.head.appendChild(pageStyle);
    // Desktop Chrome blocks here until its print dialog closes.
    // afterprint remains the primary signal for browsers with async dialogs.
    let lostFocus=false;
    const onBlur=()=>{lostFocus=true;};
    const onFocus=()=>{if(lostFocus)finish();};
    window.addEventListener('blur',onBlur,{once:true});
    window.addEventListener('focus',onFocus,{once:true});
    window.print();
    pageStyle.remove();
    window.removeEventListener('blur',onBlur);
    window.removeEventListener('focus',onFocus);
    finish();
   } catch {
    // Keep the verified modal available so the Owner can retry.
    finished=true;cleanup();printing.current=false;setPrintSnapshot(null);
    toast.error('Unable to open print dialog. Please retry.');
   }
  },100);
  return()=>{clearTimeout(timer);cleanup();};
 },[printSnapshot]);
 function print() {
  if(printing.current || !selected?.shops.length)return;
  printing.current=true;
  setPrintSnapshot({...selected,shops:selected.shops.map(s=>({...s})),printedAt:new Date().toLocaleString('en-IN')});
 }
 return <section className="route-balance-page">
  <div className="route-balance-hero"><div className="route-balance-intro"><div className="route-balance-symbol"><MapPin size={26}/></div><div><span className="route-balance-eyebrow">COLLECTION OVERVIEW</span><h1>Route balance</h1><p>Track pending shop dues, route by route.</p></div></div><div className="route-balance-note"><Wallet size={17}/><span>View dues &middot; Print collection list</span></div></div>
  {!loading&&!error&&<div className="route-balance-stats">
   <div className="route-stat-card stat-blue"><div className="route-stat-top"><span>Total routes</span><span className="route-stat-icon"><MapPin size={20}/></span></div><strong>{routes.length}</strong><small>Your company route network</small></div>
   <div className="route-stat-card stat-amber"><div className="route-stat-top"><span>Routes with dues</span><span className="route-stat-icon"><Wallet size={20}/></span></div><strong>{routes.filter(r=>/[1-9]/.test(r.total)).length}</strong><small>Pending shop collections</small></div>
   <div className="route-stat-card stat-green"><div className="route-stat-top"><span>No pending dues</span><span className="route-stat-icon"><CircleCheck size={20}/></span></div><strong>{routes.filter(r=>!/[1-9]/.test(r.total)).length}</strong><small>No positive shop balances</small></div>
  </div>}

  {error?<div role="alert" className="route-balance-error"><p>{error}</p><button onClick={refresh}>Try again</button></div>:loading?<p role="status" className="route-balance-loading">Loading route balances...</p>:<div className="route-balance-panel"><div className="route-balance-panel-title"><div><h2>Route overview</h2><p>Shop balances and assigned drivers, in one place.</p></div><span>{routes.length} routes</span></div><table className="dues-table route-balance-table"><thead><tr>{['S.No','Route Name','Driver Name','Total Balance','Action'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{routes.map((r,i)=><tr key={r.id}><td data-label="S.No"><span className="route-row-number">{String(i+1).padStart(2,'0')}</span></td><td data-label="Route Name" className="route-name-cell"><span className="route-name-wrap"><span className="route-name-icon"><MapPin size={15}/></span><span>{r.name}</span></span></td><td data-label="Driver Name">{r.driver_name?<span className="route-driver-chip"><UserRound size={14}/><span>{r.driver_name}</span></span>:<span className="route-driver-unassigned">-</span>}</td><td data-label="Total Balance" className="dues-money"><span className={/[1-9]/.test(r.total)?'route-amount has-dues':'route-amount'}>{duesCurrency(r.total)}</span></td><td data-label="Action"><button disabled={busy} onClick={()=>view(r.id)} className="route-view-button">View <ArrowUpRight size={15} aria-hidden="true"/></button></td></tr>)}</tbody></table>{!routes.length&&<p className="route-balance-empty">No routes found.</p>}</div>}
  {selected&&<div className="dues-overlay"><div role="dialog" aria-modal="true" aria-labelledby="dues-title" className="dues-modal">
   <div className="dues-modal-heading"><span className="dues-eyebrow">ROUTE BASED DUES</span><h2 id="dues-title">Shop Balance</h2><div className="dues-route-details"><div><span>Route</span><strong>{selected.name}</strong></div><div className="dues-driver"><span>Driver</span><strong>{selected.driver_name||'-'}</strong></div></div></div>
   <div className="dues-modal-body"><table className="dues-table dues-shop-table"><thead><tr><th className="dues-serial-heading"><span>S.No</span></th><th>Shop Name</th><th>Balance Amount</th></tr></thead><tbody><ShopRows shops={selected.shops}/></tbody></table></div>
   <div className="dues-modal-footer"><div className="dues-total"><span>Total Outstanding</span><strong>{duesCurrency(selected.total)}</strong></div><div className="dues-modal-actions"><button disabled={!!printSnapshot} onClick={()=>setSelected(null)} className="dues-close">Close</button><button disabled={!!printSnapshot} onClick={print} className="dues-print">Print</button></div></div>
  </div></div>}
  {printSnapshot&&createPortal(<article id="route-dues-receipt"><header><strong>AVS Billing</strong><h2>ROUTE BASED DUES</h2></header><div className="dues-print-meta"><p><strong>Route:</strong> {printSnapshot.name.replace(/\s+route\s*$/i,'').trim()}</p><p><strong>Driver:</strong> {printSnapshot.driver_name||'-'}</p></div><p className="dues-print-date">{printSnapshot.printedAt}</p><table><thead><tr><th className="dues-serial-heading"><span>S.No</span></th><th>Shop Name</th><th>Credit Balance</th></tr></thead><tbody><ShopRows shops={printSnapshot.shops}/></tbody></table><p className="dues-grand">Grand Total: {duesCurrency(printSnapshot.total)}</p></article>,document.body)}
 </section>;
}
