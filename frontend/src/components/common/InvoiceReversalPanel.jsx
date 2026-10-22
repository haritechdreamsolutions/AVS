import React, { useState } from 'react';
import { apiFetch, API_URL } from '../../context/AppContext';
import { toast } from 'sonner';

export function InvoiceReversalPanel({ sale, onUpdated }) {
  const [form,setForm]=useState({amount:'',payment_mode:'CASH',reason:'',reference:'',idempotency_key:crypto.randomUUID()});
  const [saving,setSaving]=useState(false);
  const change=(key,value)=>setForm(previous=>({...previous,[key]:value,idempotency_key:crypto.randomUUID()}));
  const perform=async operation=>{
    if(saving)return;
    setSaving(true);
    try {
      const response=await apiFetch(API_URL+'/sales/'+sale.id+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data=await response.json();
      if(!response.ok || !data.success)throw new Error(data.message || 'Unable to record operation');
      toast.success(operation==='refund'?'Payment reversal recorded':'Invoice cancelled');
      setForm({amount:'',payment_mode:'CASH',reason:'',reference:'',idempotency_key:crypto.randomUUID()});
      onUpdated();
    } catch(error){toast.error(error.message);}
    finally{setSaving(false);}
  };
  if(sale.status==='CANCELLED')return null;
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
    <h4 className="font-bold text-sm">Payment reversal and cancellation</h4>
    <p className="text-xs text-slate-600">Record only a cash refund or UPI reversal already completed. Reverse all received payments before cancelling.</p>
    <div className="grid grid-cols-2 gap-2">
      <input aria-label="Refund amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={event=>change('amount',event.target.value)} placeholder="Refund amount" className="rounded-xl border p-2" />
      <select aria-label="Refund payment method" value={form.payment_mode} onChange={event=>change('payment_mode',event.target.value)} className="rounded-xl border p-2"><option value="CASH">Cash</option><option value="GPAY">UPI</option></select>
      <input aria-label="Refund reason" value={form.reason} onChange={event=>change('reason',event.target.value)} placeholder="Reason" className="rounded-xl border p-2" />
      <input aria-label="Refund reference" value={form.reference} onChange={event=>change('reference',event.target.value)} placeholder="Reference" className="rounded-xl border p-2" />
    </div>
    <div className="flex gap-2">
      <button type="button" disabled={saving || !form.amount || !form.reason.trim()} onClick={()=>perform('refund')} className="rounded-xl bg-amber-700 text-white px-3 py-2 disabled:opacity-50">Record refund</button>
      <button type="button" disabled={saving} onClick={()=>perform('cancel')} className="rounded-xl border border-rose-300 text-rose-700 px-3 py-2 disabled:opacity-50">Cancel invoice</button>
    </div>
  </section>;
}
