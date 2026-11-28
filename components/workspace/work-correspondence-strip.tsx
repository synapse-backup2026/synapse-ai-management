'use client';
import {responsibilityForAccount, memberResponsibility} from '../../lib/organizational-logins';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Mail,Inbox,Send,Clock3,ArrowUpLeft,RefreshCw,MoreHorizontal,Globe,MessageSquareText} from 'lucide-react';
import './work-correspondence-strip.css';

type Ticket={id:string;title:string;assignee:string;created_by:string;created_at:string;request_state:string;unit?:string;source?:string;routing?:{ownerRole?:string}};
type Row={key:string;id:string;title:string;source:string;department:string;owner:string;state:string;date:string;kind:'inbound'|'outbound'|'internal';raw?:any};
const statuses:Record<string,string>={routed:'ارجاع‌شده',waiting_internal:'منتظر پاسخ',waiting_customer:'منتظر پاسخ مشتری',waiting_approval:'منتظر تأیید',closed:'بسته',awaiting_assignment:'بدون مسئول',todo:'جدید',doing:'در حال انجام',blocked:'منتظر دیگران',review:'منتظر تأیید',done:'تکمیل‌شده'};
const fa=(n:number)=>n.toLocaleString('fa-IR');
const prettyDate=(s:string)=>{try{return s?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Dubai'}).format(new Date(s)):'—'}catch{return s?.slice(0,10)||'—'}};
export default function WorkCorrespondenceStrip({records=[],members=[],user,onOpen}:{records?:any[];members?:any[];user?:any;onOpen?:(r:any)=>void}){
 const [response,setResponse]=useState<{tickets:Ticket[],user:{email:string}}|null>(null);
 const [error,setError]=useState(''),[tab,setTab]=useState('all');
 async function load(){try{const r=await fetch('/api/internal-tickets',{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error||'خطای دریافت مکاتبات');setResponse(d);setError('')}catch(e:any){setError(e.message||'دریافت مکاتبات ممکن نشد.')}}
 useEffect(()=>{void load()},[]);
 const email=user?.email||response?.user?.email||'';
 const rows=useMemo(()=>{
  const internal:Row[]=(response?.tickets||[]).map(t=>({key:'mail:'+t.id,id:t.id,title:t.title||'مکاتبه بدون عنوان',source:'مکاتبه داخلی',department:t.unit||'بین واحدها',owner:memberResponsibility({role_code:t.routing?.ownerRole})||responsibilityForAccount(t.assignee,members),state:t.request_state,date:t.created_at,kind:t.created_by===email?'outbound':'internal'}));
  const operations:Row[]=records.filter(r=>r.manualOperationId).map(r=>({key:'work:'+r.id,id:r.manualOperationId,title:r.title||'تیکت ارجاع‌شده',source:'ارجاع از پذیرش',department:r.unit||'واحد نامشخص',owner:responsibilityForAccount(r.assignee,members),state:r.status,date:r.updated_at||r.updatedAt||r.created_at||'',kind:'inbound',raw:r}));
  return [...internal,...operations].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 },[response?.tickets,records,members,email]);
 const filtered=rows.filter(r=>tab==='all'||tab==='inbound'&&r.kind==='inbound'||tab==='outbound'&&r.kind==='outbound'||tab==='internal'&&r.source==='مکاتبه داخلی').slice(0,7);
 const options=[{key:'all',title:'همه'},{key:'inbound',title:'تیکت‌های دریافتی'},{key:'outbound',title:'تیکت‌های ارسالی'},{key:'internal',title:'مکاتبات بین واحدها'}] as const;
 const counts={all:rows.length,inbound:rows.filter(r=>r.kind==='inbound').length,outbound:rows.filter(r=>r.kind==='outbound').length,internal:rows.filter(r=>r.source==='مکاتبه داخلی').length};
 return <section className="work-correspondence wrd-correspondence" dir="rtl" aria-label="تیکت‌ها و مکاتبات اخیر">
  <header className="wrd-correspondence-head"><div><Mail size={25}/><strong>تیکت‌ها و مکاتبات اخیر</strong></div><nav aria-label="دسته‌بندی مکاتبات">{options.map(opt=><button type="button" key={opt.key} aria-pressed={tab===opt.key} className={tab===opt.key?'current':''} onClick={()=>setTab(opt.key)}>{opt.title} <span>({fa(counts[opt.key])})</span></button>)}<button type="button" title="به‌روزرسانی" aria-label="به‌روزرسانی" onClick={()=>void load()}><RefreshCw size={15}/></button></nav></header>
  {error&&<div role="status" className="wrd-correspondence-warning">بخشی از مکاتبات در دسترس نیست: {error} <Link href="/work/mail">دفتر مکاتبات</Link></div>}
  <div className="wrd-table-scroll"><table><thead><tr><th>کد</th><th>عنوان</th><th>منبع</th><th>واحد مرتبط</th><th>مسئول</th><th>وضعیت</th><th>تاریخ</th><th aria-label="جزئیات"/></tr></thead><tbody>
   {filtered.map(r=><tr key={r.key}><td><bdi>{r.id.slice(0,21)}</bdi></td><td>{r.raw&&onOpen?<button type="button" className="wrd-ticket-title" onClick={()=>onOpen(r.raw)}>{r.title}</button>:<Link href="/work/mail">{r.title}</Link>}</td><td><span className="wrd-table-source">{r.source==='مکاتبه داخلی'?<Mail size={15}/>:<Globe size={15}/>} {r.source}</span></td><td>{r.department}</td><td>{r.owner}</td><td><span className={'wrd-table-state '+(r.state==='done'||r.state==='closed'?'done':r.state==='doing'?'doing':r.state.includes('waiting')||r.state==='blocked'?'waiting':'new')}>{statuses[r.state]||r.state}</span></td><td>{prettyDate(r.date)}</td><td>{r.raw&&onOpen?<button className="wrd-row-more" type="button" onClick={()=>onOpen(r.raw)} aria-label="مشاهده تیکت"><MoreHorizontal size={18}/></button>:<Link href="/work/mail" aria-label="مشاهده مکاتبه"><MoreHorizontal size={18}/></Link>}</td></tr>)}
  </tbody></table>{!filtered.length&&<div className="wrd-table-empty">{!response&&!error?'در حال دریافت مکاتبات…':'مورد واقعی در این دسته ثبت نشده است.'}</div>}</div>
 </section>;
}
