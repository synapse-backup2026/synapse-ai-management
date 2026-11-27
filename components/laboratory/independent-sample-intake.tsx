'use client';
import {useEffect,useState} from 'react';
import {ClipboardList,CheckCircle2,PackageCheck,Send,Search,Plus,FlaskConical,RefreshCw} from 'lucide-react';
import {intakeCategories,intakeUnits,intakeSuppliers,intakePreparations} from '../../lib/sample-intake-catalog';
import './independent-sample-intake.css';

type Sample={id:string;name:string;category:string;sample_type:string;quantity:number;unit:string;amount_per_unit:string;supplier:string;preparation:string;treatment:string;transport:string;storage:string;notes:string;received:number;lab_id:string;lab_name:string;requested_labs?:string[];sent:number;lab_received:number;status:string;receipt?:any;dispatch?:any;lab_receipt?:any;history:any[]};
type Entry={id:string;revision:number;researcher_name:string;researcher_phone:string;researcher_email:string;organization:string;project_title:string;notes:string;samples:Sample[];history:any[]};
const states:Record<string,string>={registered:'ثبت اولیه',received:'دریافت پژوهشکده',sent:'ارسال به آزمایشگاه',lab_received:'تأیید آزمایشگاه',lab_issue:'مغایرت دریافت آزمایشگاه'};
const fa=(n:number)=>Number(n||0).toLocaleString('fa-IR');
async function parse(r:Response){const txt=await r.text();let v:any;try{v=JSON.parse(txt)}catch{throw Error('پاسخ سرور ناقص است (HTTP '+r.status+').')}if(!r.ok)throw Error(v.error||'خطای سامانه');return v}
export default function IndependentSampleIntake(){
 const [data,setData]=useState<any>(null),[id,setId]=useState(''),[sampleId,setSampleId]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const selected:Entry|undefined=data?.records?.find((r:Entry)=>r.id===id),sample:Sample|undefined=selected?.samples?.find(s=>s.id===sampleId);
 async function load(nextId=id){const res=await parse(await fetch('/api/sample-intake/independent'+(nextId?'?id='+encodeURIComponent(nextId):''),{cache:'no-store'}));setData(res);return res}
 useEffect(()=>{void load('').catch(e=>setError(e.message))},[]);
 async function submit(action:string,e:React.FormEvent<HTMLFormElement>,extra:any={}){
  e.preventDefault();if(busy)return;const form=e.currentTarget;const fd=new FormData(form),body:any=Object.fromEntries(fd);
  const key=form.dataset.requestKey||(form.dataset.requestKey=crypto.randomUUID());
  for(const prop of ['quantity','packages'])if(prop in body)body[prop]=Number(body[prop]);
  if(action==='add_sample')body.requested_labs=fd.getAll('requested_labs').map(String);
  setBusy(true);setError('');setMessage('');
  try{const response=await parse(await fetch('/api/sample-intake/independent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...extra,action,key,id:action==='create'?undefined:id,revision:selected?.revision})}));
   const target=action==='create'?response.id:id;setId(target);await load(target);form.reset();delete form.dataset.requestKey;
   if(action==='create')setMessage('مشخصات محقق و پروژه ثبت شد. اکنون نمونه‌ها را در برگه زیر وارد کنید.');
   else if(action==='send')setMessage('ارجاع به آزمایشگاه ثبت شد؛ تأیید دریافت هنوز انجام نشده است.');
   else if(action==='lab_receive')setMessage('نتیجه دریافت آزمایشگاه با نام حساب مجاز ثبت شد.');
   else setMessage('اطلاعات ثبت و از پایگاه داده بازخوانی شد.');
  }catch(err:any){setError(err.message)}finally{setBusy(false)}
 }
 async function deleteSelected(){
  if(!selected||busy)return;
  const reason=window.prompt('دلیل بایگانی برگه را وارد کنید.');
  if(!reason?.trim()||!window.confirm('این برگه در سیناپس بایگانی شود؟'))return;
  setBusy(true);setError('');setMessage('');
  try{
   await parse(await fetch('/api/sample-intake/independent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:selected.id,revision:selected.revision,reason,confirmed:true})}));
   setId('');setSampleId('');await load('');setMessage('برگه از فهرست پذیرش حذف شد.');
  }catch(err:any){setError(err.message)}finally{setBusy(false)}
 }
 const results=(data?.records||[]).filter((r:Entry)=>!query||[r.researcher_name,r.project_title,r.organization,r.id,...r.samples.map(s=>s.name)].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <section className="independent-intake" dir="rtl" aria-label="پذیرش مستقل نمونه">
  <div className="independent-hero"><div className="independent-hero-icon"><FlaskConical size={28}/></div><div><small>SYNAPSE / SAMPLE REGISTRATION</small><h1>پذیرش نمونه محققین</h1><p>ثبت محقق، پروژه و نمونه بدون الزام شماره پرونده یا فاکتور؛ دریافت و تحویل آزمایشگاه با ثبت تاریخچه مستقل</p></div></div>
  {error&&<p className="independent-error" role="alert">{error}</p>}{message&&<p className="independent-success" role="status"><CheckCircle2 size={16}/>{message}</p>}
  <div className="independent-steps"><span><b>۱</b> مشخصات محقق و برگه نمونه</span><span><b>۲</b> دریافت و کنترل محموله</span><span><b>۳</b> ارجاع و تأیید آزمایشگاه</span></div>
  {data?.can_create&&!selected&&<form className="independent-panel" onSubmit={e=>void submit('create',e)}>
    <h2><ClipboardList size={18}/> ۱. مشخصات محقق و پروژه</h2>
    <p className="independent-note">فاکتور و شماره پرونده برای ایجاد این برگه الزامی نیستند. شناسه پذیرش به‌صورت خودکار ثبت می‌شود.</p>
    <div className="independent-fields">
      <label>نام و نام خانوادگی محقق<input name="researcher_name" required maxLength={180}/></label>
      <label>عنوان پروژه یا هدف ارسال نمونه<input name="project_title" required maxLength={180}/></label>
      <label>شماره تماس<input name="researcher_phone" maxLength={80} dir="ltr"/></label>
      <label>ایمیل محقق<input name="researcher_email" type="email" maxLength={200} dir="ltr"/></label>
      <label>دانشگاه / سازمان<input name="organization" maxLength={240}/></label>
      <label>توضیحات مقدماتی<input name="notes" maxLength={4000}/></label>
    </div><button className="independent-primary" disabled={busy}>ثبت و ایجاد برگه نمونه</button>
   </form>}
  {selected&&<div className="independent-selected"><div><b>{selected.researcher_name}</b><span>{selected.project_title}</span><small>شناسه داخلی: <bdi>{selected.id}</bdi> · {fa(selected.samples.length)} قلم نمونه</small></div><button type="button" onClick={()=>{setId('');setSampleId('');setMessage('')}}>برگه جدید / بازگشت به فهرست</button></div>}
  {selected&&data?.can_delete&&<button type="button" disabled={busy} onClick={()=>void deleteSelected()}>حذف برگه از فهرست</button>}
  {selected&&<div className="independent-panel">
    <h2><FlaskConical size={18}/> برگه مشخصات نمونه‌ها</h2>
    {data?.can_create&&<SampleForm busy={busy} onSubmit={e=>void submit('add_sample',e)} category={category} setCategory={setCategory} laboratories={data.laboratories||[]}/>}
    <div className="independent-items">{selected.samples.map(s=><button type="button" key={s.id} className={sampleId===s.id?'current':''} onClick={()=>setSampleId(s.id)}><span>{s.name} · {s.sample_type}</span><small>{fa(s.quantity)} {s.unit} · {states[s.status]||s.status}</small></button>)}</div>
    {!!selected.samples.length&&<div className="independent-table" aria-label="برگه ثبت نمونه"><table><thead><tr><th>نام نمونه</th><th>نوع</th><th>مقدار و تعداد</th><th>حمل و نگهداری</th><th>آزمایشگاه مقصد</th><th>وضعیت تحویل</th></tr></thead><tbody>{selected.samples.map(s=><tr key={s.id}><td>{s.name}<small>{s.id.slice(0,18)}</small></td><td>{s.category}<small>{s.sample_type}</small></td><td>{fa(s.quantity)} {s.unit}<small>{s.amount_per_unit||''}</small></td><td>{s.transport||'—'}<small>{s.storage||''} · {s.preparation||''} · {s.supplier||''}</small></td><td>{s.lab_name||'در انتظار تعیین مسئول مجاز'}{!s.lab_name&&!!s.requested_labs?.length&&<small>پیشنهادی: {(data.laboratories||[]).filter((l:any)=>s.requested_labs?.includes(l.id)).map((l:any)=>l.name).join('، ')}</small>}</td><td>{states[s.status]||s.status}</td></tr>)}</tbody></table></div>}
    {!!selected.samples.length&&!sample&&<p className="independent-note">برای ثبت تحویل یا ارجاع، نمونه موردنظر را از برگه بالا انتخاب کنید.</p>}
  </div>}
  {selected&&sample&&<div className="independent-panel" key={sample.id}>
    <h2><PackageCheck size={18}/> ۲. دریافت و کنترل نمونه: {sample.name}</h2>
    <div className="independent-spec"><span>مقدار و تعداد: {fa(sample.quantity)} {sample.unit}</span><span>شرایط حمل: {sample.transport||'ثبت نشده'}</span><span>نگهداری: {sample.storage||'ثبت نشده'}</span><span>وضعیت: {states[sample.status]}</span></div>
    {data.can_create&&sample.status==='registered'&&<form className="independent-fields" onSubmit={e=>void submit('receive',e,{sample_id:sample.id})}>
      <label>تعداد تحویل‌گرفته‌شده<input name="quantity" required type="number" min={1} max={sample.quantity} defaultValue={sample.quantity}/></label>
      <label>نام تحویل‌دهنده<input name="delivered_by" maxLength={180} required/></label>
      <label>تعداد بسته‌ها<input name="packages" required type="number" min={1} defaultValue={1}/></label>
      <label>شماره رهگیری (اختیاری)<input name="tracking" maxLength={160}/></label>
      <label>شرایط ظاهری و بسته‌بندی<input name="condition" required maxLength={1000}/></label>
      <label>شرح کسری یا مغایرت<input name="discrepancy" maxLength={2000}/></label>
      <button className="independent-primary" disabled={busy}>ثبت دریافت واقعی در پژوهشکده</button>
    </form>}
    {sample.receipt&&<p className="independent-note">دریافت پژوهشکده: {fa(sample.received)} قلم · ثبت‌کننده {sample.receipt.actor} · {new Date(sample.receipt.at).toLocaleString('fa-IR')}</p>}
    <h2><Send size={18}/> ۳. تعیین آزمایشگاه و تحویل</h2>
    {data.can_assign&&sample.status==='received'&&<form className="independent-fields" onSubmit={e=>void submit('send',e,{sample_id:sample.id})}>
      <label>آزمایشگاه مقصد واقعی<select name="lab_id" required defaultValue={sample.requested_labs?.[0]||''}><option value="">انتخاب آزمایشگاه فعال</option>{data.laboratories.map((l:any)=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
      <label>تعداد ارسال‌شده<input name="quantity" required type="number" min={1} max={sample.received} defaultValue={sample.received}/></label>
      <label className="wide">توضیحات ارجاع<input name="notes" maxLength={2000}/></label>
      <button className="independent-primary" disabled={busy}>ثبت ارسال به آزمایشگاه</button>
    </form>}
    {sample.lab_id&&<p className="independent-note">مقصد: {sample.lab_name} · تعداد ارسال‌شده {fa(sample.sent)} · وضعیت: {states[sample.status]}</p>}
    {data.laboratory&&sample.status==='sent'&&<form className="independent-fields" onSubmit={e=>void submit('lab_receive',e,{sample_id:sample.id})}>
      <label>تعداد واقعی دریافتی آزمایشگاه<input type="number" name="quantity" min={0} max={sample.sent} defaultValue={sample.sent} required/></label>
      <label>توضیح مغایرت یا تأیید<input name="notes" maxLength={2000}/></label>
      <button className="independent-primary" disabled={busy}>تأیید دریافت توسط آزمایشگاه</button>
    </form>}
    {sample.lab_receipt&&<p className="independent-note">تأیید حساب آزمایشگاه: {sample.lab_receipt.actor} · دریافت {fa(sample.lab_received)} · {new Date(sample.lab_receipt.at).toLocaleString('fa-IR')}</p>}
    {!!sample.history.length&&<details className="independent-history"><summary>تاریخچه این نمونه ({fa(sample.history.length)})</summary>{sample.history.map((h,i)=><p key={i}>{states[h.status]||h.action} · {h.actor} · {new Date(h.at).toLocaleString('fa-IR')}</p>)}</details>}
  </div>}
  <div className="independent-panel" id="independent-sample-registry">
    <div className="independent-registry-head"><h2>فهرست برگه‌ها و نمونه‌های ثبت‌شده</h2><button type="button" onClick={()=>void load().catch(e=>setError(e.message))}><RefreshCw size={14}/> بازخوانی</button></div>
    <label className="independent-search"><Search size={16}/><input placeholder="جست‌وجوی محقق، پروژه، نمونه یا شناسه…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="independent-table"><table><thead><tr><th>محقق و پروژه</th><th>برگه نمونه</th><th>تعداد اقلام</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>{results.map((entry:Entry)=><tr key={entry.id}><td><b>{entry.researcher_name}</b><small>{entry.project_title}</small></td><td><bdi>{entry.id.slice(0,25)}</bdi></td><td>{fa(entry.samples.length)}</td><td>{entry.samples.map(s=>states[s.status]||s.status).join(' · ')||'در انتظار ثبت نمونه'}</td><td><button type="button" onClick={()=>{setId(entry.id);setSampleId(entry.samples[0]?.id||'');setMessage('')}}>مشاهده برگه</button></td></tr>)}</tbody></table>{!results.length&&<p className="independent-note">برگه‌ای مطابق جست‌وجو وجود ندارد.</p>}</div>
    <p className="independent-footnote">این فهرست از رکوردهای واقعی و مجاز خوانده می‌شود. ثبت اولیه، تحویل پژوهشکده و تأیید آزمایشگاه مراحل جداگانه هستند.</p>
  </div>
 </section>;
}
function SampleForm({busy,onSubmit,category,setCategory,laboratories}:{busy:boolean;onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void;category:string;setCategory:(v:string)=>void;laboratories:any[]}){
 return <form onSubmit={onSubmit} className="independent-fields independent-new-sample">
  <label>نام یا کد نمونه / دارو / ماده<input name="name" required maxLength={180}/></label>
  <label>دسته‌بندی نمونه<select name="category" value={category} required onChange={e=>setCategory(e.target.value)}><option value="">انتخاب دسته</option>{Object.keys(intakeCategories).map(c=><option key={c}>{c}</option>)}</select></label>
  <label>نوع دقیق<select name="sample_type" required key={category} defaultValue=""><option value="">انتخاب نوع</option>{(intakeCategories[category]||[]).map(c=><option key={c}>{c}</option>)}</select></label>
  <label>تعداد<input type="number" name="quantity" required min={1} max={100000}/></label>
  <label>واحد<select name="unit" required defaultValue=""><option value="">انتخاب واحد</option>{intakeUnits.map(u=><option key={u}>{u}</option>)}</select></label>
  <label>مقدار هر واحد (در صورت لزوم)<input name="amount_per_unit" maxLength={50}/></label>
  <label>تأمین‌کننده نمونه<select name="supplier" required defaultValue=""><option value="">انتخاب تأمین‌کننده</option>{intakeSuppliers.map(v=><option key={v}>{v}</option>)}</select></label>
  <label>روش آماده‌سازی<select name="preparation" required defaultValue=""><option value="">انتخاب وضعیت</option>{intakePreparations.map(v=><option key={v}>{v}</option>)}</select></label>
  <label>تیمار نمونه یا دارو<input name="treatment" maxLength={1000}/></label>
  <label>شرایط حمل<input name="transport" maxLength={1000}/></label>
  <label>شرایط نگهداری<input name="storage" maxLength={1000}/></label>
  <label className="wide">توضیحات تخصصی<input name="notes" maxLength={4000}/></label>
  <fieldset className="independent-lab-preferences"><legend>آزمایشگاه‌های پیشنهادی برای این نمونه (اختیاری)</legend><p>این انتخاب فقط پیشنهاد روی برگه است؛ ارجاع قطعی پس از دریافت نمونه و تأیید مسئول مجاز انجام می‌شود.</p><div>{laboratories.map(l=><label key={l.id}><input type="checkbox" name="requested_labs" value={l.id}/>{l.name}</label>)}</div></fieldset>
  <button disabled={busy} className="independent-primary"><Plus size={16}/> افزودن نمونه به برگه</button>
 </form>;
}
