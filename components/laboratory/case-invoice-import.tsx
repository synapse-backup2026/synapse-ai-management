'use client';
import {useState} from 'react';
import type {InvoiceServiceLine} from '../../lib/laboratory-invoice-lines';
import {laboratoryDomains} from '../../lib/laboratory-center-policy';
import styles from './laboratory-center.module.css';

export type CaseInvoice = {
 id: string;
 number: string;
 version: number;
 revision: number;
 client: string;
 due: string;
 lines: InvoiceServiceLine[];
 choices: Record<string,string>;
};

export function invoiceAssignments(invoice: CaseInvoice, previous: any[]) {
 return laboratoryDomains.flatMap(domain => {
  const lines = invoice.lines.filter(line => (line.domain || invoice.choices[line.id]) === domain.id);
  if (!lines.length) return [];
  const former = previous.find(a => a.domain === domain.id);
  return [{domain:domain.id,laboratory_id:former?.laboratory_id||'',instructions:former?.instructions||'',due:former?.due||'',
   services:lines.map(line=>({invoice_line_id:line.id,description:line.description,quantity:line.quantity,unit:line.unit,repeats:line.repeats}))}];
 });
}

export default function CaseInvoiceImport({number, onNumber, invoice, change, draftId, openCase, onLoading}: {
 number: string;
 onNumber: (number: string) => void;
 invoice?: CaseInvoice;
 change: (invoice?: CaseInvoice) => void;
 draftId?: string;
 openCase: (id: string) => void;
 onLoading: (loading: boolean) => void;
}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[existingId,setExistingId]=useState('');
 const format=(n:number)=>n.toLocaleString('fa-IR');
 async function lookup() {
  if (!number.trim() || busy) return;
  setBusy(true);onLoading(true);setError('');setExistingId('');
  try {
   const params=new URLSearchParams({case_invoice:number.trim()});
   if(draftId)params.set('draft',draftId);
   const response=await fetch('/api/laboratory-center?'+params,{cache:'no-store'});
   const result=await response.json() as Omit<CaseInvoice,'choices'> & {existingId?:string;error?:string};
   if(!response.ok)throw Error(result.error);
   if(result.existingId){setExistingId(result.existingId);return;}
   change({...result,choices:{}});
  }catch(e){setError(e instanceof Error?e.message:'فاکتور خوانده نشد.');}
  finally{setBusy(false);onLoading(false);}
 }
 const unresolved=invoice?.lines.filter(line=>!line.domain)??[];
 const pending=unresolved.filter(line=>!invoice?.choices[line.id]).length;
 return <section className={styles.invoiceImport} aria-label="درج ردیف‌های فاکتور">
  <div><h3>واردکردن خدمات از فاکتور</h3><p>شماره فاکتور داخلی یا شماره رسمی را وارد کنید تا ردیف‌ها بر اساس حوزه کنار هم قرار بگیرند.</p></div>
  <div className={styles.invoiceActions}>
   <label>شماره فاکتور مرجع<input aria-label="شماره فاکتور مرجع" name="invoice_number" value={number} readOnly={!!invoice} required
    onChange={e=>{onNumber(e.target.value);setError('');setExistingId('');}}
    onKeyDown={e=>{if(e.key==='Enter'&&!invoice){e.preventDefault();void lookup();}}}/></label>
   <button className="secondary" type="button" onClick={()=>void lookup()} disabled={busy||!number.trim()}>
    {busy?'در حال خواندن فاکتور…':invoice?'دریافت دوباره از فاکتور':'خواندن ردیف‌های فاکتور'}
   </button>
   {invoice&&<button className="secondary" type="button" onClick={()=>{change(undefined);setError('');}}>برداشتن ردیف‌های واردشده</button>}
  </div>
  {error&&<p role="alert" className="error-banner">{error}</p>}
  {existingId&&<p role="status">این فاکتور از قبل پرونده دارد. <button type="button" className="secondary" onClick={()=>openCase(existingId)}>بازکردن پروندهٔ موجود</button></p>}
  {invoice&&<p role="status"><strong>{format(invoice.lines.length)} ردیف</strong> از فاکتور {invoice.number} · نسخهٔ {format(invoice.version)}{pending>0&&<> · {format(pending)} ردیف نیازمند تعیین حوزه</>}</p>}
  {invoice&&unresolved.length>0&&<div className={styles.invoiceUnmapped}>
   <h4>ردیف‌های نیازمند بازبینی</h4>
   {unresolved.map(line=><label key={line.id}>{line.description} · {format(line.quantity)} {line.unit}
    <select value={invoice.choices[line.id]||''} onChange={e=>change({...invoice,choices:{...invoice.choices,[line.id]:e.target.value}})}>
     <option value="">انتخاب حوزه</option>
     {laboratoryDomains.map(domain=><option key={domain.id} value={domain.id}>{domain.title}</option>)}
     <option value="excluded">خارج از دامنهٔ آزمایشگاه</option>
    </select>
   </label>)}
  </div>}
 </section>;
}
