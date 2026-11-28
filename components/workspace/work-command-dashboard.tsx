'use client';
import {canDeleteData} from '../../lib/deletion-policy';
import {responsibilityForAccount} from '../../lib/organizational-logins';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarDays,ClipboardCheck,ShieldCheck,Mail,Layers3,Inbox,Clock3,Hourglass,AlarmClock,UserRoundX,ChevronRight,ChevronLeft,Plus,ArrowUpLeft,Search,Check,CheckCircle2,Play,FileText} from 'lucide-react';
import {isWork,participant,isOverdue,executionDay,calendarDays} from '../../lib/work-policy';
import {canReview} from '../../lib/staff-policy';
import WorkCorrespondenceStrip from './work-correspondence-strip';
import InternalTickets from '../communication/internal-tickets';
import MyResponsibilities from './my-responsibilities';
import './work-command-dashboard.css';

type Props={data:any;today:string;open:(r:any)=>void;create:(kind:string,date?:string)=>void;manager:boolean;initialView?:string;initialFilter?:string;busy:boolean;onArchive:(r:any)=>void};
type Metric='all'|'new'|'today'|'waiting'|'overdue'|'unassigned';
type Section='tasks'|'plans'|'approvals'|'mail';
const fa=(n:number)=>Number(n||0).toLocaleString('fa-IR');
const dayDate=(value:string)=>new Date(value+'T12:00:00Z');
const moveDay=(value:string,days:number)=>{const d=dayDate(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const jalaliLong=(s:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Dubai'}).format(dayDate(s));
const jalaliMonth=(s:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',timeZone:'Asia/Dubai'}).format(dayDate(s));
const jalaliDay=(s:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{day:'numeric',timeZone:'Asia/Dubai'}).format(dayDate(s));
const weekday=(s:string)=>new Intl.DateTimeFormat('fa-IR',{weekday:'short',timeZone:'Asia/Dubai'}).format(dayDate(s));
const statuses:Record<string,string>={todo:'برای انجام',doing:'در حال انجام',blocked:'منتظر دیگران',review:'منتظر تأیید',changes:'نیازمند اصلاح',done:'تکمیل‌شده'};
const columns=[{id:'todo',label:'برای انجام',countLabel:'برای انجام',className:'todo',Icon:Clock3},{id:'doing',label:'در حال انجام',countLabel:'در حال انجام',className:'doing',Icon:Play},{id:'blocked',label:'منتظر دیگران',countLabel:'منتظر دیگران',className:'blocked',Icon:Hourglass},{id:'done',label:'تکمیلی',countLabel:'تکمیل‌شده',className:'done',Icon:CheckCircle2}] as const;

function MonthCalendar({anchor,today,records,onChange,onOpen,onCreate,canCreate}:{anchor:string;today:string;records:any[];onChange:(s:string)=>void;onOpen:(r:any)=>void;onCreate:(d:string)=>void;canCreate:boolean}){
 const days=calendarDays(anchor,'month');
 const first=days[0]||anchor,last=days[days.length-1]||anchor;
 const startPadding=(dayDate(first).getUTCDay()+1)%7;
 const cells:Array<string|null>=[...Array.from({length:startPadding},()=>null),...days];
 while(cells.length%7!==0)cells.push(null);
 const dayRecords=records.filter(r=>executionDay(r)===anchor).slice(0,5);
 const dayLabels=['ش','ی','د','س','چ','پ','ج'];
 return <aside className="wrd-calendar-panel" aria-label="تقویم ماهانه و برنامه امروز">
  <header className="wrd-month-head">
   <button type="button" aria-label="ماه قبل" onClick={()=>onChange(moveDay(first,-1))}><ChevronRight size={18}/></button>
   <strong>{jalaliMonth(anchor)}</strong>
   <button type="button" aria-label="ماه بعد" onClick={()=>onChange(moveDay(last,1))}><ChevronLeft size={18}/></button>
  </header>
  <div className="wrd-calendar-grid" role="grid" aria-label="تقویم شمسی">
   {dayLabels.map((label,i)=><div className="wrd-week-label" key={i}>{label}</div>)}
   {cells.map((d,i)=>d?<button type="button" key={d} onClick={()=>onChange(d)} className={'wrd-calendar-day'+(d===anchor?' chosen':'')+(d===today?' is-today':'')} aria-pressed={d===anchor} aria-label={jalaliLong(d)}><span>{jalaliDay(d)}</span>{records.some(r=>executionDay(r)===d)&&<i aria-label="دارای برنامه"/>}</button>:<span className="wrd-calendar-pad" key={'pad-'+i}/>)}
  </div>
  <section className="wrd-day-agenda">
   <header><strong>برنامه {anchor===today?'امروز':jalaliLong(anchor)}</strong><CalendarDays size={17}/></header>
   <div className="wrd-agenda-items">
    {dayRecords.map(r=><button type="button" key={r.id} onClick={()=>onOpen(r)}><span className="wrd-agenda-time">{r.startTime||'—'}</span><span>{r.title}</span><span className={'wrd-agenda-check'+(r.status==='done'?' done':'')}>{r.status==='done'?<Check size={13}/>:null}</span></button>)}
    {!dayRecords.length&&<p className="wrd-empty">برنامه‌ای برای این روز ثبت نشده است.</p>}
   </div>
   {canCreate&&<button type="button" className="wrd-add-plan" onClick={()=>onCreate(anchor)}><Plus size={18}/> افزودن برنامه</button>}
  </section>
 </aside>;
}

export default function WorkCommandDashboard({data,today,open,create,manager,initialView,initialFilter,busy,onArchive}:Props){
 const [section,setSection]=useState<Section>(initialView==='plans'||initialView==='approvals'||initialView==='mail'?initialView:'tasks');
 const [metric,setMetric]=useState<Metric>(initialView==='overview'||initialFilter==='today'?'today':initialFilter==='overdue'?'overdue':initialFilter==='waiting'?'waiting':'all');
 const [date,setDate]=useState(today);
 const [query,setQuery]=useState('');
 const [scope,setScope]=useState('mine');
 const [boardStatus,setBoardStatus]=useState<string>('');
 const [showTaskList,setShowTaskList]=useState(initialView==='all'||initialView==='overview');
 const [limit,setLimit]=useState(25);
 const [mailCount,setMailCount]=useState<number|null>(null);
 const [approvalView,setApprovalView]=useState<'pending'|'sent'|'history'>('pending');
 const [unit,setUnit]=useState('');
 const [project,setProject]=useState('');
 const authorized=useMemo(()=>((data.records||[]) as any[]).filter(isWork),[data.records]);
 const mine=useMemo(()=>authorized.filter(r=>participant(r,data.user)),[authorized,data.user]);
 const pool=manager&&scope==='all'?authorized:mine;
 const reviewable=authorized.filter(r=>r.status==='review'&&canReview(r,data.user));
 const unassigned=manager?authorized.filter(r=>!r.assignee&&r.status!=='done'):[];
 const counts={
  all:pool.length,new:pool.filter(r=>r.status==='todo').length,today:pool.filter(r=>executionDay(r)===today).length,
  waiting:pool.filter(r=>['blocked','review','changes'].includes(r.status)).length,
  overdue:pool.filter(r=>isOverdue(r,today)).length,
  unassigned:unassigned.length
 };
 const chosen=metric==='unassigned'&&manager?unassigned:pool;
 const selected=chosen.filter(r=>{
  const passes=metric==='all'||metric==='new'&&r.status==='todo'||metric==='today'&&executionDay(r)===today||metric==='waiting'&&['blocked','review','changes'].includes(r.status)||metric==='overdue'&&isOverdue(r,today)||metric==='unassigned'&&!r.assignee;
  return passes&&(!unit||r.unit===unit)&&(!project||r.project===project)&&(!query||[r.title,r.body,r.ref,r.id].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 });
 const ranked=[...selected].sort((a,b)=>String(b.updated_at||b.updatedAt||b.created_at||'').localeCompare(String(a.updated_at||a.updatedAt||a.created_at||'')));
 const availableUnits=[...new Set(authorized.map(r=>String(r.unit||'').trim()).filter(Boolean))].sort();
 const availableProjects=[...new Set(authorized.map(r=>String(r.project||'').trim()).filter(Boolean))].sort();
 const statusRows=(id:string)=>ranked.filter(r=>id==='blocked'?['blocked','review','changes'].includes(r.status):r.status===id);
 const submitted=authorized.filter(r=>r.status==='review'&&(r.submittedBy||r.assignee)===data.user.email);
 const historyIds=new Set((data.events||[]).filter((e:any)=>['approve','return','information'].includes(e.action)).map((e:any)=>e.record_id));
 const approvals=approvalView==='pending'?reviewable:approvalView==='sent'?submitted:authorized.filter(r=>historyIds.has(r.id));
 const memberLabel=(email:string)=>{
  return responsibilityForAccount(email,data.members);
 };
 const modules=[
  {id:'mail',label:'مکاتبات داخلی',sub:'مکاتبات بین واحدها و تاریخچه',Icon:Mail},
  {id:'approvals',label:'بررسی و تأیید',sub:'درخواست‌ها و موارد نیازمند تأیید',Icon:ShieldCheck},
  {id:'tasks',label:'کارتابل وظایف',sub:'همه وظایف، وظایف امروز، برد وظایف',Icon:ClipboardCheck},
  {id:'plans',label:'برنامه‌ریزی',sub:'تقویم، برنامه‌های روزانه و آتی',Icon:CalendarDays}
 ] as const;
 const metrics=[
  {id:'all',label:'همه موارد',Icon:Layers3},
  {id:'new',label:'جدید',Icon:Mail},
  {id:'today',label:'امروز',Icon:CalendarDays},
  {id:'waiting',label:'منتظر اقدام',Icon:Hourglass},
  {id:'overdue',label:'موعد گذشته',Icon:AlarmClock},
  ...(manager?[{id:'unassigned',label:'بدون مسئول',Icon:UserRoundX}]:[])
 ] as const;
 return <div className="work-command work-reference-dashboard" dir="rtl">
  <header className="wrd-title"><div className="wrd-title-icon"><CalendarDays size={38}/></div><div><h1>کارتابل و برنامه‌ریزی</h1><p>مدیریت وظایف، برنامه‌ها، تیکت‌ها و مکاتبات سازمانی</p></div></header>
  <nav className="wrd-module-row" aria-label="بخش‌های کارتابل و برنامه‌ریزی">{modules.map(({id,label,sub,Icon})=><button type="button" key={id} onClick={()=>{setSection(id);setLimit(25)}} aria-pressed={section===id} className={'wrd-module wrd-module-'+id+(section===id?' active':'')}><span className="wrd-module-arrow"><ChevronLeft size={23}/></span><Icon className="wrd-module-icon" size={49} strokeWidth={1.8}/><span className="wrd-module-copy"><strong>{label}{id==='mail'&&mailCount!==null?' · '+fa(mailCount):id==='approvals'?' · '+fa(reviewable.length):''}</strong><small>{sub}</small></span></button>)}</nav>
  <section className="wrd-metrics" aria-label="آمار قابل کلیک کارتابل">{metrics.map(({id,label,Icon})=><button type="button" key={id} className={'wrd-metric wrd-metric-'+id+(metric===id&&section==='tasks'?' selected':'')} onClick={()=>{setSection('tasks');setMetric(id as Metric);setBoardStatus('');setShowTaskList(true);setLimit(25)}} aria-pressed={section==='tasks'&&metric===id}><Icon size={31} strokeWidth={1.7}/><span>{label}</span><strong>{fa(counts[id as Metric])}</strong></button>)}</section>
  {section==='tasks'&&<div className="wrd-work-grid">
   <MonthCalendar anchor={date} today={today} records={mine} onChange={setDate} onOpen={open} onCreate={d=>create('plan',d)} canCreate={manager}/>
   <div className="wrd-right-column"><section className="wrd-board" aria-label="برد وظایف من">
    <header className="wrd-board-top"><h2><ClipboardCheck size={23}/> برد وظایف من</h2><div className="wrd-board-filters">
     {manager&&<select aria-label="دامنه وظایف" value={scope} onChange={e=>setScope(e.target.value)}><option value="mine">وظایف من</option><option value="all">همه وظایف مجاز</option></select>}
     <select aria-label="فیلتر واحد" value={unit} onChange={e=>setUnit(e.target.value)}><option value="">همه واحدها</option>{availableUnits.map(x=><option key={x} value={x}>{x}</option>)}</select>
     <select aria-label="فیلتر پروژه" value={project} onChange={e=>setProject(e.target.value)}><option value="">همه پروژه‌ها</option>{availableProjects.map(x=><option key={x} value={x}>{x}</option>)}</select>
     <label className="wrd-board-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجوی وظایف، تیکت‌ها، فاکتور..." aria-label="جست‌وجوی وظایف"/></label>
    </div></header>
    <div className="wrd-columns">{columns.map(({id,label,Icon})=><section className={'wrd-column wrd-col-'+id} key={id}>
     <button type="button" className="wrd-column-heading" onClick={()=>{setBoardStatus(boardStatus===id?'':id);setShowTaskList(true)}} aria-pressed={boardStatus===id}><Icon size={17}/><span>{label}</span><strong>({fa(statusRows(id).length)})</strong></button>
     <div className="wrd-column-items">{statusRows(id).slice(0,3).map(r=><button key={r.id} type="button" className="wrd-task-card" onClick={()=>open(r)}><b>{r.title}</b><span>{memberLabel(r.assignee)} · {r.ref||r.project||'بدون شناسه مرجع'}</span>{r.status==='doing'&&<span className="wrd-progress"><i style={{width:Math.max(0,Math.min(100,Number(r.progress||0)))+'%'}}/></span>}{r.status==='done'&&<CheckCircle2 size={17} className="wrd-complete"/>}</button>)}{!statusRows(id).length&&<p className="wrd-small-empty">موردی در این وضعیت نیست.</p>}</div>
     <button className="wrd-column-action" onClick={()=>{setBoardStatus(id);setMetric('all');setShowTaskList(true)}}>{id==='todo'||id==='doing'?'مشاهده همه':'مشاهده موارد'} <ArrowUpLeft size={13}/></button>
    </section>)}</div>
    {!showTaskList&&<button className="wrd-expand-tasks" onClick={()=>setShowTaskList(true)}>مشاهده فهرست آخرین وظایف <ChevronLeft size={15}/></button>}
    {showTaskList&&<div className="wrd-task-list wrd-organized-list">
     <div className="wrd-task-list-heading"><strong>{boardStatus?columns.find(c=>c.id===boardStatus)?.label:'فهرست وظایف'}</strong><span>{fa((boardStatus?statusRows(boardStatus):ranked).length)} مورد</span></div>
     {(boardStatus?statusRows(boardStatus):ranked).slice(0,limit).map(r=><div className="wrd-organized-row" key={r.id}>
      <button type="button" className="wrd-open-task" onClick={()=>open(r)}><span><strong>{r.title}</strong><small>{memberLabel(r.assignee)} · {executionDay(r)?jalaliLong(executionDay(r)):'بدون موعد'}</small></span><span className={'wrd-task-state wrd-state-'+r.status}>{statuses[r.status]||r.status}</span></button>
      {canDeleteData(data.user)&&<button type="button" disabled={busy} className="wrd-delete-task" aria-label={'حذف '+r.title} onClick={()=>onArchive(r)}>حذف</button>}
     </div>)}
     {!(boardStatus?statusRows(boardStatus):ranked).length&&<p className="wrd-empty">برای این فیلتر وظیفه‌ای ثبت نشده است.</p>}
     {(boardStatus?statusRows(boardStatus):ranked).length>limit&&<button type="button" onClick={()=>setLimit(limit+25)}>نمایش وظایف بیشتر</button>}
     <button className="wrd-collapse-tasks" onClick={()=>setShowTaskList(false)}>بستن فهرست</button>
    </div>}
   </section><WorkCorrespondenceStrip records={authorized} members={data.members} user={data.user} onOpen={open} onMailCount={setMailCount}/></div>
  </div>}
  {section==='plans'&&<div className="wrd-work-grid wrd-plan-view"><MonthCalendar anchor={date} today={today} records={mine} onChange={setDate} onOpen={open} onCreate={d=>create('plan',d)} canCreate={manager}/><section className="wrd-board"><header className="wrd-board-top"><h2><CalendarDays size={23}/> برنامه‌ریزی روزانه و آینده</h2></header><div className="wrd-plan-date">برنامه‌های {jalaliLong(date)}</div>{mine.filter(r=>executionDay(r)===date).map(r=><button className="wrd-plan-item" key={r.id} onClick={()=>open(r)}>{r.title}<small>{statuses[r.status]||r.status}</small></button>)}{!mine.some(r=>executionDay(r)===date)&&<p className="wrd-empty">برنامه‌ای برای تاریخ انتخاب‌شده وجود ندارد.</p>}</section></div>}
  {section==='approvals'&&<section className="wrd-secondary">
   <header><h2><ShieldCheck/> بررسی و تأیید</h2></header>
   <div className="work-tabs">{([['pending','منتظر تأیید'],['sent','ارسال‌شده توسط من'],['history','تاریخچه تصمیم‌ها']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={approvalView===id} onClick={()=>{setApprovalView(id);setLimit(25)}}>{label}</button>)}</div>
   <p>تعداد موارد: {fa(approvals.length)}</p>
   {approvals.slice(0,limit).map(r=><button className="wrd-plan-item" key={r.id} onClick={()=>open(r)}>{r.title}<small>{statuses[r.status]||r.status}</small></button>)}
   {approvals.length>limit&&<button type="button" onClick={()=>setLimit(limit+25)}>نمایش موارد بیشتر</button>}
   {!approvals.length&&<p className="wrd-empty">در این بخش موردی برای حساب شما ثبت نشده است.</p>}
  </section>}
  {section==='mail'&&<section className="wrd-secondary"><header><h2><Mail/> مکاتبات داخلی</h2><Link href="/work/mail">سوابق مکاتبات ثبت‌شده</Link></header><InternalTickets onInboxCount={setMailCount}/></section>}
  {section!=='tasks'&&section!=='mail'&&<WorkCorrespondenceStrip records={authorized} members={data.members} user={data.user} onOpen={open} onMailCount={setMailCount}/>}
  {section==='tasks'&&data.sampleReferralCount>0&&<section className="wrd-secondary"><header><h2>برگه‌های ارجاعی نمونه</h2><Link href="/sample-intake?mode=referrals">{fa(data.sampleReferralCount)} برگه ارجاع‌شده</Link></header></section>}
  <details className="wrd-responsibilities"><summary><FileText size={16}/> نقش و مسئولیت‌های سازمانی من</summary><MyResponsibilities user={data.user} organization={data.organization}/></details>
  <footer className="wrd-footnote">آمار و محتوا از پرونده‌های واقعی قابل‌دسترسی خوانده می‌شوند. ثبت ایمیل یا تماس به‌تنهایی وظیفه جدید ایجاد نمی‌کند.</footer>
 </div>;
}
