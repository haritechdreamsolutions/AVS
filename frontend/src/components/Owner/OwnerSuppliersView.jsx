import {formatLitres} from '../../utils/productVolume';
import {companyProductActive} from '../../../../shared/supplierProducts.js';
﻿import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {purchaseReportRows} from '../../utils/purchaseReport';
import {useApp} from '../../context/AppContext';
import {Building2,Plus,Package,UserRound,Phone,ArrowUpRight,Pencil,Trash2,X,Save,Search,Receipt,Printer} from 'lucide-react';
import './companiesInward.css';
import {ProductImage} from '../common/ProductImage';
import {resolveProductImageUrl} from '../../utils/productImageHelper';
const currency=value=>'₹'+Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const quantity=(qty,unit,ppu=1)=>{
 if(String(unit).toLowerCase()==='tray'){const count=Math.round(Number(qty)*Number(ppu)),trays=Math.floor(count/Number(ppu)),loose=count%Number(ppu);return [trays?`${trays} Tray`:'',loose?`${loose} Pcs`:''].filter(Boolean).join(' + ')||'0 Tray';}
 return `${Number(qty).toLocaleString('en-IN',{maximumFractionDigits:4})} ${unit||''}`;
};
const rateCurrency=value=>'\u20b9'+Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:12});
function PurchaseRows({rows}){return rows.map(r=><tr key={r.id}><td>{String(r.movement_date||'').split('-').reverse().join('-')}</td><td>{r.product_name}</td><td>{quantity(r.qty,r.unit,r.pieces_per_unit)}</td><td>{r.litres == null ? '0' : formatLitres(r.litres)+' L'}</td><td>{rateCurrency(r.report_rate)}{r.effective_rate&&<small>Average / {r.unit}</small>}</td><td>{currency(r.total)}</td></tr>);}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const emptyCompany={name:'',contact_person:'',phone:''};
const emptyProduct={existing_product_id:'',tray_rate:'',piece_rate:''};

export function OwnerSuppliersView(){
 const {apiFetch,API_URL,products:contextProducts=[],setSuppliers}=useApp();
 const [companies,setCompanies]=useState([]);
 const [fallbackProducts,setFallbackProducts]=useState([]);
 const master=contextProducts.length?contextProducts:fallbackProducts;
 const [tab,setTab]=useState('companies'),[selected,setSelected]=useState(''),[catalog,setCatalog]=useState(null),[catalogBusy,setCatalogBusy]=useState(false);
 const [search,setSearch]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [deletingCompany,setDeletingCompany]=useState(null);
 const [companyForm,setCompanyForm]=useState(null),[productForm,setProductForm]=useState(null);
 const [filters,setFilters]=useState({supplier_id:'ALL',product_id:'ALL',start_date:'',end_date:''});
 const [report,setReport]=useState(null),[reportBusy,setReportBusy]=useState(false),[reportError,setReportError]=useState('');
 const [filterProducts,setFilterProducts]=useState([]),[filterProductsBusy,setFilterProductsBusy]=useState(false),[printSnapshot,setPrintSnapshot]=useState(null);
 const printLock=useRef(false);
 const saveLock=useRef(false),selection=useRef(selected);selection.current=selected;
 async function request(path,options={}){
  const response=await apiFetch(`${API_URL}${path}`,options);
  const data=await response.json();if(!response.ok||data.success===false)throw new Error(data.message||'Unable to complete request');return data;
 }
 const write=(path,method,data)=>request(path,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 async function loadDirectory(){
  const [list,products]=await Promise.all([request('/suppliers?include_inactive=true'),contextProducts.length?Promise.resolve(null):request('/products')]);
  setCompanies(list);if(products)setFallbackProducts(products);return list;
 }
 useEffect(()=>{let live=true;loadDirectory().catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 useEffect(()=>{
  setCatalog(null);if(!selected)return;
  let live=true;const controller=new AbortController();setCatalogBusy(true);
  request(`/suppliers/${selected}/products?summary=true`,{signal:controller.signal}).then(data=>{if(live)setCatalog(data);}).catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(live)setCatalogBusy(false);});
  return()=>{live=false;controller.abort();};
 },[selected]);
 useEffect(()=>{
  if(!loading&&filters.supplier_id!=='ALL'&&!companies.some(c=>c.is_active!==false&&String(c.id)===String(filters.supplier_id)))setFilters(old=>({...old,supplier_id:'ALL',product_id:'ALL'}));
 },[companies,loading,filters.supplier_id]);
 useEffect(()=>{
  if(tab!=='purchases')return;
  let live=true;const controller=new AbortController();setReport(null);setReportError('');
  if(filters.start_date&&filters.end_date&&filters.start_date>filters.end_date){setReportError('From date must be on or before To date.');setReportBusy(false);return;}
  setReportBusy(true);
  const params=new URLSearchParams([...Object.entries(filters).filter(([,value])=>value&&value!=='ALL'),['active_products_only','true']]);
  request('/suppliers/inward-report?'+params,{signal:controller.signal}).then(data=>{if(live)setReport(data);}).catch(e=>{if(live&&e.name!=='AbortError')setReportError(e.message);}).finally(()=>{if(live)setReportBusy(false);});
  return()=>{live=false;controller.abort();};
 },[tab,filters]);
 useEffect(()=>{
  if(tab!=='purchases')return;
  let live=true;const controller=new AbortController();setFilterProducts([]);setFilterProductsBusy(true);
  request('/suppliers/report-products?'+new URLSearchParams({supplier_id:filters.supplier_id}),{signal:controller.signal}).then(data=>{if(live){setFilterProducts(data);setFilters(old=>old.supplier_id===filters.supplier_id&&old.product_id!=='ALL'&&!data.some(p=>String(p.id)===String(old.product_id))?{...old,product_id:'ALL'}:old);}}).catch(e=>{if(live&&e.name!=='AbortError')setReportError(e.message);}).finally(()=>{if(live)setFilterProductsBusy(false);});
  return()=>{live=false;controller.abort();};
 },[tab,filters.supplier_id,companies]);
 useEffect(()=>{
  if(!printSnapshot)return;
  let cancelled=false;
  const finish=()=>{printLock.current=false;setPrintSnapshot(null);};
  window.addEventListener('afterprint',finish);
  const timer=setTimeout(async()=>{try{await document.fonts.ready;if(!cancelled)window.print();}catch{finish();setReportError('Unable to open A4 print. Please retry.');}},0);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('afterprint',finish);};
 },[printSnapshot]);
 async function mutation(work,message){
  if(saveLock.current)return;saveLock.current=true;setSaving(true);setError('');setNotice('');
  try{
   await work();setNotice(message);
   const updatedCompanies=await loadDirectory();
   if(setSuppliers)setSuppliers(updatedCompanies);
   const activeId=selection.current;
   if(activeId){try{const data=await request(`/suppliers/${activeId}/products?summary=true`);if(selection.current===activeId)setCatalog(data);}catch{if(selection.current===activeId){setCatalog(null);setSelected('');}}}
  }catch(e){setError(e.message);}finally{saveLock.current=false;setSaving(false);}
 }
 async function productMutation(work,message){
  if(saveLock.current)return;saveLock.current=true;setSaving(true);setError('');setNotice('');
  try{
   const data=await work();
   if(!data?.supplier)throw Error('Company update response is missing. Please reload and retry.');
   const supplier=data.supplier;
   setCompanies(previous=>previous.map(c=>String(c.id)===String(supplier.id)?supplier:c));
   if(setSuppliers)setSuppliers(previous=>previous.map(c=>String(c.id)===String(supplier.id)?supplier:c));
   if(selection.current===String(supplier.id))setCatalog(previous=>({...previous,supplier}));
   setNotice(message);
  }catch(e){setError(e.message);}finally{saveLock.current=false;setSaving(false);}
 }
 const selectedCompany=companies.find(c=>String(c.id)===String(selected));
 const setProduct=(key,value)=>setProductForm(old=>{
  const next={...old,[key]:value};
  const product=master.find(p=>String(p.id)===String(next.existing_product_id));
  if(key==='tray_rate'&&product?.selling_unit==='Tray')next.piece_rate=next.tray_rate!==''?(Number(next.tray_rate)/Number(product.pieces_per_unit||1)).toFixed(2):'';
  return next;
 });
 function configureProduct(p){
  const assigned=companyProductActive(catalog?.supplier?.product_rates,p.id);
  const value=catalog?.supplier?.product_rates?.[p.id]??p.purchase_price;
  const rates=typeof value==='object'?value:{tray_rate:value};
  setError('');setProductForm({...emptyProduct,existing_product_id:String(p.id),id:assigned?p.id:null,tray_rate:rates.tray_rate??rates.rate??'',piece_rate:rates.piece_rate??''});
 }
 function toggleCompanyProduct(p){
  const assigned=companyProductActive(catalog?.supplier?.product_rates,p.id);
  if(assigned)return productMutation(()=>write(`/suppliers/${selected}/products/${p.id}`,'DELETE'),'Product deactivated for this company. Previous purchases are retained.');
  const old=catalog?.supplier?.product_rates?.[p.id];
  const rate=typeof old==='object'?Number(old.tray_rate??old.rate):Number(old??p.purchase_price);
  if(rate<=0){configureProduct(p);return;}
  const buy_rates={tray_rate:rate,...(p.selling_unit==='Tray'?{piece_rate:typeof old==='object'&&old.piece_rate!==undefined?old.piece_rate:Number((rate/Number(p.pieces_per_unit||1)).toFixed(2))}:{})};
  return productMutation(()=>write(`/suppliers/${selected}/products`,'POST',{existing_product_id:p.id,buy_rates}),'Product activated for this company.');
 }
 const filter=(key,value)=>setFilters(old=>({...old,[key]:value,...(key==='supplier_id'?{product_id:'ALL'}:{})}));
 const linked=master.find(p=>String(p.id)===String(productForm?.existing_product_id));
 const units=linked?.selling_unit;
 const pieces=Number(linked?.pieces_per_unit)||1;
 const pieceRate=productForm?.piece_rate!==''?productForm?.piece_rate:(Number(productForm?.tray_rate||0)/pieces).toFixed(2);
 const reportRows=purchaseReportRows(report?.records||[]);
 const totalLitres=reportRows.reduce((sum,r)=>sum+(r.litres||0),0);
 const totalReport=reportRows.reduce((sum,r)=>sum+Math.round(r.total*100),0)/100;
 function printPurchaseReport(){
  if(printLock.current||!reportRows.length||reportBusy||reportError)return;
  printLock.current=true;
  setPrintSnapshot({rows:reportRows.map(r=>({...r})),total:totalReport,totalLitres,company:companies.find(c=>String(c.id)===String(filters.supplier_id))?.name||'All companies',product:filterProducts.find(p=>String(p.id)===String(filters.product_id))?.display_name||'All products',from:filters.start_date,to:filters.end_date,printedAt:today()});
 }

 return <section className="ci-page">
  <header className="ci-hero"><div className="ci-hero-icon"><Building2 size={29}/></div><div><span>PURCHASE MANAGEMENT</span><h1>Companies & Inward</h1><p>Company products, purchase rates and every stock receipt in one place.</p></div><button disabled={saving} onClick={()=>{setError('');setCompanyForm({...emptyCompany});}}><Plus size={17}/> Add company</button></header>
  <nav className="ci-tabs" aria-label="Purchase views"><button aria-pressed={tab==='companies'} onClick={()=>setTab('companies')}><Building2 size={17}/> Companies & products</button><button aria-pressed={tab==='purchases'} onClick={()=>setTab('purchases')}><Receipt size={17}/> Purchase history</button></nav>
  {error&&<p role="alert" className="ci-error">{error}</p>}{notice&&<p role="status" className="ci-notice">{notice}</p>}
  {tab==='companies'&&<>
   <div className="ci-section-heading"><div><h2>Purchase companies</h2><p>Add a company, then activate products from Products & Rates.</p></div><label className="ci-search"><Search size={16}/><input type="search" aria-label="Search companies" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company or manager"/></label></div>
   {loading?<p role="status">Loading companies...</p>:<div className="ci-company-grid">{companies.filter(c=>c.is_active!==false).filter(c=>`${c.name} ${c.contact_person||''} ${c.phone||''}`.toLowerCase().includes(search.toLowerCase())).map(c=><article key={c.id} className={`ci-company-card ${String(c.id)===String(selected)?'ci-selected':''}`}><div className="ci-company-top"><span className="ci-company-icon"><Building2 size={23}/></span><span className="ci-count">{master.filter(p=>p.is_active!==false&&companyProductActive(c.product_rates,p.id)).length} products</span></div><h3>{c.name}</h3><p><UserRound size={14}/>{c.contact_person||'Manager not assigned'}</p><p><Phone size={14}/>{c.phone||'Phone not assigned'}</p><footer><button disabled={saving} className="ci-link" onClick={()=>{setSelected(String(c.id));setError('');}}><Package size={16}/><span>View products</span><ArrowUpRight size={15}/></button><div className="ci-row-actions"><button className="ci-icon-button" aria-label={`Edit ${c.name}`} disabled={saving} onClick={()=>setCompanyForm({id:c.id,name:c.name,contact_person:c.contact_person||'',phone:c.phone||''})}><Pencil size={15}/></button><button className="ci-icon-button ci-danger" aria-label={`Delete company ${c.name}`} title="Delete company" disabled={saving} onClick={()=>{setError('');setDeletingCompany(c);}}><Trash2 size={15}/></button></div></footer></article>)}</div>}
   {!loading&&!companies.some(c=>c.is_active!==false)&&<div className="ci-empty"><Building2 size={28}/><h3>Add your first purchase company</h3><p>Create a company with its manager details, then activate existing products.</p></div>}
   {selected&&<article className="ci-panel"><div className="ci-section-heading"><div><span className="ci-eyebrow">COMPANY PRODUCTS</span><h2>{selectedCompany?.name}</h2><p>Activate existing products for this company. Only active products appear in Stock Receive.</p></div><span className="ci-count">{master.filter(p=>p.is_active!==false&&companyProductActive(catalog?.supplier?.product_rates,p.id)).length} active products</span></div>
    {catalogBusy?<p role="status">Loading company products...</p>:<div className="ci-table-scroll"><table><thead><tr><th>Product</th><th>Purchase unit</th><th>Pieces / unit</th><th>Buy rate / unit</th><th>Buy rate / piece</th><th>Active</th><th>Actions</th></tr></thead><tbody>{master.filter(p=>p.is_active!==false&&!p.deleted_at).map(p=>{
     const active=companyProductActive(catalog?.supplier?.product_rates,p.id);
     const configured=catalog?.supplier?.product_rates?.[p.id]??p.purchase_price;
     const rates=typeof configured==='object'?configured:{tray_rate:configured};
     const rate=Number(rates?.tray_rate??rates?.rate??0);
     return <tr key={p.id} className={active?'ci-company-product-active':''}><td><div className="ci-product-name"><ProductImage src={resolveProductImageUrl(p)} alt={p.display_name||p.name} size={42}/><div><strong>{p.display_name||p.name}</strong><small>{p.category_name||'General'}</small></div></div></td><td>{p.selling_unit}</td><td>{p.pieces_per_unit}</td><td>{currency(rate)}</td><td>{p.selling_unit==='Tray'?currency(rates?.piece_rate??Number((rate/Number(p.pieces_per_unit||1)).toFixed(2))):'-'}</td><td><button type="button" role="switch" aria-checked={active} aria-label={`${active?'Deactivate':'Activate'} ${p.display_name||p.name}`} className={`ci-product-switch ${active?'is-active':''}`} disabled={saving} onClick={()=>toggleCompanyProduct(p)}><span/>{active?'Active':'Inactive'}</button></td><td><button className="ci-icon-button" aria-label={`Edit rates ${p.display_name||p.name}`} disabled={saving} onClick={()=>configureProduct(p)}><Pencil size={15}/></button></td></tr>;
    })}</tbody></table>{!master.some(p=>p.is_active!==false&&!p.deleted_at)&&<div className="ci-empty"><Package size={26}/><p>No active master products. Add products in Products & Rates first.</p></div>}</div>}
   </article>}

  </>}
  {tab==='purchases'&&<>
   <div className="ci-panel ci-filters"><label>Company<select aria-label="Filter company" value={filters.supplier_id} disabled={!!printSnapshot} onChange={e=>filter('supplier_id',e.target.value)}><option value="ALL">All companies</option>{companies.filter(c=>c.is_active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Product<select aria-label="Filter product" disabled={filterProductsBusy||!!printSnapshot} value={filters.product_id} onChange={e=>filter('product_id',e.target.value)}><option value="ALL">All products</option>{filterProducts.map(p=><option key={p.id} value={p.id}>{p.display_name||p.name}</option>)}</select></label><label>From date<input type="date" value={filters.start_date} disabled={!!printSnapshot} onChange={e=>filter('start_date',e.target.value)}/></label><label>To date<input type="date" value={filters.end_date} disabled={!!printSnapshot} onChange={e=>filter('end_date',e.target.value)}/></label></div>
   {reportError&&<p role="alert" className="ci-error">{reportError}</p>}{reportBusy&&<p role="status">Loading purchase history...</p>}
   {report&&<article className="ci-panel ci-purchase-report"><div className="ci-section-heading"><div><h2>Purchase transactions</h2><p>Purchases matching the selected company, product and dates.</p></div><button disabled={reportBusy||!!printSnapshot||!reportRows.length||!!reportError} onClick={printPurchaseReport}><Printer size={17}/> Print A4</button></div><div className="ci-table-scroll"><table className="ci-report-table"><thead><tr>{['Date','Product name','Qty','Litres','Rate','Total amount'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><PurchaseRows rows={reportRows}/></tbody><tfoot><tr><td colSpan={3}>Grand total</td><td className="ci-total-litres">{formatLitres(totalLitres)} L</td><td></td><td>{currency(totalReport)}</td></tr></tfoot></table></div>{!reportRows.length&&<p className="ci-empty">No purchases match these filters.</p>}{reportRows.some(r=>r.effective_rate)&&<p className="ci-help">Mixed tray/piece receipts show the average rate per purchase unit, preserving the original received amount.</p>}</article>}

  </>}
  {printSnapshot&&createPortal(<article id="ci-purchase-print"><h1>{printSnapshot.company}</h1><table><thead><tr>{['Date','Product name','Qty','Litres','Rate','Total amount'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><PurchaseRows rows={printSnapshot.rows}/></tbody><tfoot><tr><td colSpan={3}>Grand total</td><td className="ci-total-litres">{formatLitres(printSnapshot.totalLitres)} L</td><td></td><td>{currency(printSnapshot.total)}</td></tr></tfoot></table>{printSnapshot.rows.some(r=>r.effective_rate)&&<p className="ci-print-note">Average rates are shown for mixed tray/piece receipts. Original purchase amounts are retained.</p>}</article>,document.body)}
  {deletingCompany&&<div className="ci-overlay"><div role="alertdialog" aria-modal="true" aria-labelledby="ci-delete-title" aria-describedby="ci-delete-description" className="ci-modal"><header><div><span className="ci-eyebrow">DELETE COMPANY</span><h2 id="ci-delete-title">Delete {deletingCompany.name}?</h2></div><button className="ci-icon-button" aria-label="Close delete confirmation" disabled={saving} onClick={()=>setDeletingCompany(null)}><X size={20}/></button></header><div className="ci-delete-body"><p id="ci-delete-description">This company and its <strong>{master.filter(p=>p.is_active!==false&&companyProductActive(deletingCompany.product_rates,p.id)).length} product assignments</strong> will be removed from the active company list and Stock Receive. Previous purchases, reports and existing stock will be retained.</p>{error&&<p role="alert" className="ci-error">{error}</p>}<footer><button autoFocus className="ci-secondary" disabled={saving} onClick={()=>setDeletingCompany(null)}>Cancel</button><button className="ci-delete-confirm" disabled={saving} onClick={()=>mutation(async()=>{
    const id=String(deletingCompany.id);await write(`/suppliers/${id}`,'DELETE');
    if(selection.current===id){selection.current='';setSelected('');setCatalog(null);setProductForm(null);}
    setDeletingCompany(null);
   },'Company deleted. Previous purchases and reports are retained.')}><Trash2 size={16}/>{saving?'Deleting...':'Delete company'}</button></footer></div></div></div>}
  {companyForm&&<div className="ci-overlay"><div role="dialog" aria-modal="true" aria-labelledby="ci-company-title" className="ci-modal"><header><div><span className="ci-eyebrow">PURCHASE COMPANY</span><h2 id="ci-company-title">{companyForm.id?'Edit company':'Add company'}</h2></div><button className="ci-icon-button" aria-label="Close company form" disabled={saving} onClick={()=>setCompanyForm(null)}><X size={20}/></button></header><form onSubmit={e=>{e.preventDefault();mutation(async()=>{const data=await write(companyForm.id?`/suppliers/${companyForm.id}`:'/suppliers',companyForm.id?'PUT':'POST',companyForm);setSelected(String(data.supplier.id));setCompanyForm(null);},'Company saved. Activate its existing products below.');}}><label>Company name<input required maxLength={150} value={companyForm.name} onChange={e=>setCompanyForm({...companyForm,name:e.target.value})}/></label><label>Manager name<input required maxLength={100} value={companyForm.contact_person} onChange={e=>setCompanyForm({...companyForm,contact_person:e.target.value})}/></label><label>Manager phone<input required type="tel" maxLength={30} value={companyForm.phone} onChange={e=>setCompanyForm({...companyForm,phone:e.target.value})}/></label>{error&&<p role="alert" className="ci-error">{error}</p>}<footer><button type="button" className="ci-secondary" disabled={saving} onClick={()=>setCompanyForm(null)}>Cancel</button><button disabled={saving}><Save size={16}/>{saving?'Saving...':'Save company'}</button></footer></form></div></div>}
  {productForm&&linked&&<div className="ci-overlay"><div role="dialog" aria-modal="true" aria-labelledby="ci-product-title" className="ci-modal"><header><div><span className="ci-eyebrow">{selectedCompany?.name}</span><h2 id="ci-product-title">{productForm.id?'Edit purchase rates':'Activate product'}</h2></div><button className="ci-icon-button" aria-label="Close product form" disabled={saving} onClick={()=>setProductForm(null)}><X size={20}/></button></header><form onSubmit={e=>{e.preventDefault();productMutation(async()=>{const result=await write(`/suppliers/${selected}/products${productForm.id?'/'+productForm.id:''}`,productForm.id?'PUT':'POST',{existing_product_id:linked.id,buy_rates:{tray_rate:productForm.tray_rate,...(units==='Tray'?{piece_rate:pieceRate}:{})}});setProductForm(null);return result;},'Company product rates saved and product activated.');}}>
   <div className="ci-product-name"><ProductImage src={resolveProductImageUrl(linked)} alt={linked.display_name||linked.name} size={64}/><div><strong>{linked.display_name||linked.name}</strong><small>{units}{units==='Tray'?` / ${pieces} pieces`:''}</small></div></div>
   <div className="ci-form-grid"><label>Purchase rate / {units} (INR)<input required type="number" min="0.01" step="0.01" value={productForm.tray_rate} onChange={e=>setProduct('tray_rate',e.target.value)}/></label>{units==='Tray'&&<label>Purchase rate / piece (INR)<input type="number" min="0.01" step="0.01" value={productForm.piece_rate} placeholder={pieceRate} onChange={e=>setProduct('piece_rate',e.target.value)}/></label>}</div>
   {units==='Tray'&&<p className="ci-help">Loose pieces use {currency(pieceRate)} per piece.</p>}{error&&<p role="alert" className="ci-error">{error}</p>}<footer><button type="button" className="ci-secondary" disabled={saving} onClick={()=>setProductForm(null)}>Cancel</button><button disabled={saving}><Save size={16}/>{saving?'Saving...':productForm.id?'Save rates':'Save & activate'}</button></footer>
  </form></div></div>}

 </section>;
}
