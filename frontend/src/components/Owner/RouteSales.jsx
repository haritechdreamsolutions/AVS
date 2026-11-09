import React, {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,MapPin,Printer,RefreshCw} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {formatLitres} from '../../utils/productVolume';
import {routeSalesDates} from '../../utils/routeSalesDates';
import {groupRouteSalesByShop} from '../../utils/routeSalesRows';
import './routeSales.css';

const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'—';
function SalesTable({rows,products,printing=false}){
 const [width,setWidth]=useState(()=>window.innerWidth);
 useEffect(()=>{const resize=()=>setWidth(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const total=rows.reduce((sum,row)=>sum+row.litres,0);
 const size=printing?8:width<760?Math.max(products.length,1):width<1100?4:8;
 const groups=[];for(let i=0;i<products.length;i+=size)groups.push(products.slice(i,i+size));
 if(!groups.length)groups.push([]);
 return <div className="rs-table-groups">{groups.map((group,part)=><div key={part} className="rs-table-part">
 {groups.length>1&&<p className="rs-part-label">Products {part*size+1}–{Math.min((part+1)*size,products.length)} of {products.length} · Total L includes all products</p>}
 <table><colgroup><col className="rs-col-no"/><col className="rs-col-date"/><col className="rs-col-shop"/>{group.map(p=><col key={p.id}/>)}<col className="rs-col-total"/></colgroup><thead><tr><th>S.No</th><th>Date</th><th>Shop name</th>{group.map(p=><th className="rs-product-heading" key={p.id} title={p.name}><span>{p.name}</span></th>)}<th>Total L</th></tr></thead>
 <tbody>{rows.map((row,index)=><tr key={JSON.stringify([row.date,row.shop_id,row.shop_name])}><td>{index+1}</td><td className="rs-date">{dateLabel(row.date)}{row.endDate&&row.endDate!==row.date&&<><br/><span className="rs-date-end">to {dateLabel(row.endDate)}</span></>}</td><td className="rs-shop">{row.shop_name}</td>{group.map(p=>{const cell=row.products[p.id];return <td key={p.id}>{cell?cell.isTray?<span className="rs-volume-value">{formatLitres(cell.litres)} L</span>:<>{formatLitres(cell.qty)} <small>{cell.unit}</small></>:'0'}</td>;})}<td className="rs-litres">{formatLitres(row.litres)} L</td></tr>)}</tbody>
 <tfoot><tr><td colSpan={group.length+3}>Total litres</td><td className="rs-litres">{formatLitres(total)} L</td></tr></tfoot></table></div>)}</div>;
}

export function RouteSales(){
 const {apiFetch,API_URL}=useApp();
 const [routes,setRoutes]=useState([]),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null);
 const [filters,setFilters]=useState({village:'',shop:'',from:'',to:''});
 const [period,setPeriod]=useState('');
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[print,setPrint]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();let live=true;setBusy(true);setError('');setDetail(null);
  apiFetch(`${API_URL}/owner/route-sales${selected?'/'+selected:''}`,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.message||'Unable to load route sales');return data;}).then(data=>{if(live){if(selected)setDetail(data);else setRoutes(data);}}).catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;controller.abort();};
 },[selected,revision,API_URL,apiFetch]);
 const invalidDates=filters.from&&filters.to&&filters.from>filters.to;
 const rows=useMemo(()=>invalidDates?[]:groupRouteSalesByShop((detail?.rows||[]).filter(r=>(!filters.village||String(r.village_id)===filters.village)&&(!filters.shop||String(r.shop_id)===filters.shop)&&(!filters.from||r.date>=filters.from)&&(!filters.to||r.date<=filters.to))),[detail,filters,invalidDates]);
 const shops=useMemo(()=>(detail?.shops||[]).filter(s=>!filters.village||String(s.village_id)===filters.village).map(s=>[String(s.id),s.name]),[detail,filters.village]);
 useEffect(()=>{
  if(!print)return;let cancelled=false;
  const done=()=>setPrint(null);window.addEventListener('afterprint',done);
  const timer=setTimeout(async()=>{await document.fonts.ready;if(!cancelled)window.print();},0);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('afterprint',done);};
 },[print]);
 const clearFilters=()=>{setFilters({village:'',shop:'',from:'',to:''});setPeriod('');};
 const changeRoute=id=>{clearFilters();setSelected(id);};
 const choosePeriod=value=>{setPeriod(value);setFilters(f=>({...f,...routeSalesDates(value)}));};
 const total=rows.reduce((sum,r)=>sum+r.litres,0);
 return <section className={`rs-page ${!selected ? 'rs-overview' : ''}`}>
  <header className="rs-hero"><div className="rs-title"><MapPin size={28}/><div><span>COMPLETED ROUTE REPORTS</span><h1>{selected?detail?.route.name||'Route Sales':'Route Sales'}</h1><p>Sales from storekeeper verified stock returns · Tray products in litres</p></div></div><div className="rs-actions">{selected&&<button onClick={()=>changeRoute(null)}><ArrowLeft size={16}/>Back</button>}<button disabled={busy||!!print} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>Refresh</button></div></header>
  {error&&<p role="alert" className="rs-error">{error}</p>}
  {busy?<p className="rs-panel" role="status">Loading route sales...</p>:!error&&!selected?<div className="rs-route-list">{routes.map((route,index)=><article key={route.id} className="rs-route" style={{animationDelay:`${Math.min(index,8)*65}ms`}}><div className="rs-route-identity"><span className="rs-route-icon"><MapPin size={24}/></span><div><span className="rs-route-eyebrow">ROUTE SALES</span><h2>{route.name}</h2></div></div><div className="rs-route-volume"><strong>{formatLitres(route.litres)} L</strong><span>Total sales volume</span></div><button onClick={()=>changeRoute(route.id)}>View<ArrowRight size={16}/></button></article>)}{!routes.length&&<p className="rs-panel">No routes found.</p>}</div>:!error&&detail&&<>
   <div className="rs-panel rs-filters rs-cascade-filters">
    <div className="rs-location-row">
     <label>Village name<select aria-label="Village name" value={filters.village} onChange={e=>setFilters(f=>({...f,village:e.target.value,shop:''}))}><option value="">All villages in this route</option>{(detail.villages||[]).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
     <label>Shop name<select aria-label="Shop name" value={filters.shop} onChange={e=>setFilters(f=>({...f,shop:e.target.value}))}><option value="">{filters.village?'All shops in this village':'All shops in this route'}</option>{shops.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    <div className="rs-date-row">
     <div className="rs-periods" role="group" aria-label="Date shortcuts">{[['today','Today'],['yesterday','Yesterday'],['week','This Week'],['month','This Month']].map(([value,label])=><button key={value} type="button" aria-pressed={period===value} onClick={()=>choosePeriod(value)}>{label}</button>)}</div>
     <label>From date<input aria-label="From date" type="date" value={filters.from} onChange={e=>{setPeriod('');setFilters(f=>({...f,from:e.target.value}));}}/></label>
     <label>To date<input aria-label="To date" type="date" value={filters.to} onChange={e=>{setPeriod('');setFilters(f=>({...f,to:e.target.value}));}}/></label>
     <button onClick={clearFilters}>Clear filters</button>
    </div>
   </div>
   {invalidDates&&<p role="alert" className="rs-error">From date must be on or before To date.</p>}
   <article className="rs-panel"><div className="rs-report-heading"><div><h2>Shop sales</h2><p>{rows.length} records · <strong>{formatLitres(total)} L</strong></p></div></div><div className="rs-scroll"><SalesTable rows={rows} products={detail.products}/></div>{!rows.length&&<p className="rs-empty">No completed sales match these filters.</p>}<footer className="rs-footer"><button disabled={!rows.length||!!print||!!invalidDates} onClick={()=>setPrint({route:detail.route.name,rows,products:detail.products,filters:{...filters},shop:shops.find(([id])=>id===filters.shop)?.[1]||'All shops'})}><Printer size={17}/>Print A4</button></footer></article>
  </>}
  {print&&createPortal(<article id="route-sales-print"><h1>{print.route}</h1><SalesTable rows={print.rows} products={print.products} printing/></article>,document.body)}
 </section>;
}
