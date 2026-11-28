import styles from './synapse-dashboard.module.css';
import {Home,CalendarDays,ArrowLeft,ChevronLeft,ClipboardList,ClipboardCheck,Clock3,Target,CalendarClock,Bell,Plus,Layers,Info,Mail,FlaskConical,Users,FileCheck2,WalletCards} from 'lucide-react';
import {workspacePreviews} from '../../lib/navigation';
import {hasAccess} from '../../lib/auth-policy';
import {workStatuses} from '../../lib/work-policy';
const fa=(n:number)=>n.toLocaleString('fa-IR');
const date=(s:string)=>{const value=new Date(s+'T12:00:00Z');return Number.isFinite(value.getTime())?new Intl.DateTimeFormat('fa-IR',{dateStyle:'long',timeZone:'Asia/Dubai'}).format(value):'تاریخ نیازمند بررسی'};
const href=(r:any)=>'/staff?id='+encodeURIComponent(r.id);
const ranks:Record<string,string>={normal:'عادی',high:'بالا',urgent:'فوری'};
function Empty({children}:{children:React.ReactNode}){return <div className="home-v2-empty"><span aria-hidden="true">—</span><p>{children}</p></div>}
export default function PersonalHome({u,d,message}:{u:any,d:any,message:string[]}){
 const {priorities,nextPlan,counts}=d.dashboard,notices=d.importantNotifications,management=d.managementMessages;
 const quick=[
 ...(hasAccess(u,'calls')?[{label:'ثبت تماس',Icon:Plus,tone:'blue',href:'/operations?new=call',hint:'ثبت ورودی تماس'}]:[]),
 ...(u.manager?[{label:'ثبت وظیفه',Icon:ClipboardCheck,tone:'green',href:'/staff?view=all&new=task',hint:'ثبت و ارجاع وظیفه'}]:[{label:'وظایف من',Icon:ClipboardCheck,tone:'green',href:'/staff?view=all',hint:'مشاهده کارهای ارجاع‌شده'}]),
 {label:'برنامه امروز',Icon:CalendarDays,tone:'blue',href:'/staff?view=plans',hint:'برنامه و تقویم من'},
 ...(hasAccess(u,'operations')?[{label:'درخواست مشتری',Icon:Layers,tone:'purple',href:'/operations?new=request',hint:'ثبت درخواست مشتری'}]:[]),
 ...(u.manager||hasAccess(u,'sample_intake')||hasAccess(u,'research_supervision')?[{label:'برگه نمونه',Icon:FlaskConical,tone:'green',href:'/sample-intake',hint:'ثبت مستقیم برگه نمونه و تیک آزمایشگاه پیشنهادی؛ بدون Google Sheets'}]:[]),
 ...(hasAccess(u,'lab_operations')||hasAccess(u,'sample_intake')?[{label:'پرونده آزمایشگاهی',Icon:FlaskConical,tone:'purple',href:'/laboratories?view=new',hint:'ثبت پرونده آزمایشگاهی'}]:[]),
 ...(hasAccess(u,'finance_ops')?[{label:'مالی و قراردادها',Icon:WalletCards,tone:'green',href:'/finance/dashboard',hint:'داشبورد مالی و قراردادها'}]:[]),
 ...(hasAccess(u,'mail')?[{label:'مکاتبات داخلی',Icon:Mail,tone:'purple',href:'/work/mail',hint:'مشاهده مکاتبات داخلی'}]:[]),
 {label:'کارتابل من',Icon:ClipboardList,tone:'blue',href:'/staff?view=dashboard',hint:'مشاهده کارهای ثبت و ارجاع‌شده به حساب من'},
 ];
 const previews=workspacePreviews(u);
 return <main className={'home-v2 '+styles.dashboard} dir="rtl">
  <div className="home-v2-intro">
   <section className="home-v2-heading"><div><span className="home-v2-icon blue"><Home size={27}/></span><h1>خانه من</h1></div><p className="home-v2-date"><CalendarDays size={15}/>{date(d.todayKey)}</p><p className="home-v2-greeting">مرکز پیگیری درخواست‌ها، وظایف و پرونده‌های پژوهشکده</p></section>
   <section className="home-v2-motivation home-v2-neural" aria-label="نمای خوشامدگویی SYNAPSE"><div className="home-v2-quote"><img className={styles.brandIntro} src="/brand/synapse-horizontal.jpeg" alt="SYNAPSE"/><div><h2>خوش آمدید، {u.name||'همکار پژوهشکده'}</h2><p>سامانه یکپارچه پیگیری فعالیت‌های پژوهشکده</p></div></div></section>
  </div>

  <section className="home-v2-stats" aria-label="خلاصه کارهای من">{[{label:'اولویت امروز',n:counts.today,description:'کارهای مهم و برنامه‌ریزی‌شده',Icon:ClipboardList,tone:'green',href:'/staff?view=overview'},{label:'تصمیم منتظر',n:counts.decisions,description:'در انتظار بررسی و تأیید شما',Icon:ClipboardCheck,tone:'orange',href:'/staff?view=approvals'},{label:'موعدگذشته',n:counts.overdue,description:'نیازمند اقدام و پیگیری',Icon:Clock3,tone:'red',href:'/staff?view=all&scope=mine&filter=overdue'}].map(s=><a href={s.href} key={s.label} className={'home-v2-stat '+s.tone}><span className={'home-v2-icon '+s.tone}><s.Icon size={27}/></span><div><strong>{fa(s.n)}</strong><b>{s.label}</b><small>{s.description}</small></div><ChevronLeft size={18}/></a>)}</section>
  <div className="home-v2-body">
   <div className="home-v2-main">
    <section className="home-v2-panel home-v2-quick"><div className="home-v2-section-title"><h2><span className="home-v2-icon blue"><Plus size={23}/></span>دسترسی سریع</h2><small><Info size={14}/>متناسب با نقش و سطح دسترسی شما</small></div><div className="home-v2-shortcuts">{quick.map(q=><a href={q.href} key={q.label} className={q.tone} title={q.hint}><q.Icon size={32}/><b>{q.label}</b></a>)}</div><details className="home-domain-menu"><summary>دسترسی به بخش‌های سامانه</summary><section className="workspace-previews" aria-label="حوزه‌های اصلی سامانه">{previews.map((group,index)=><a key={group.id} href={group.href} className="workspace-preview"><span className="workspace-preview-icon" aria-hidden="true">{index===0?<Users/>:index===1?<ClipboardList/>:index===2?<FlaskConical/>:index===3?<Layers/>:index===4?<FileCheck2/>:<Target/>}</span><h2>{group.title}</h2><p>{group.description}</p><div className="workspace-preview-links">{group.links.map(link=><span key={link.href}>{link.label}</span>)}</div></a>)}</section></details></section>
    <section className="home-v2-panel home-v2-priorities"><div className="home-v2-section-title"><h2><span className="home-v2-icon purple"><Target size={23}/></span>اولویت‌های من</h2><a href="/staff?view=all&scope=mine">مشاهده همه<ChevronLeft size={15}/></a></div>
    {priorities.length?<div className="home-v2-task-list">{priorities.map((r:any)=><a key={r.id} href={href(r)} className={'home-v2-task priority-'+r.priority}><span className="home-v2-task-icon">{r.kind==='scientific'?<FlaskConical size={25}/>:r.collaborators?.length?<Users size={25}/>:<FileCheck2 size={25}/>}</span><div><b>{r.title}</b><small>اولویت {ranks[r.priority]||'عادی'}{r.startTime?' · ساعت '+r.startTime:''}{r.due?' · موعد '+(r.due===d.todayKey?'امروز':date(r.due)):''}</small></div><span className={'home-v2-status status-'+r.status}>{workStatuses[r.status]||r.status}</span><ChevronLeft size={17}/></a>)}</div>:<Empty>اولویت بازی برای امروز ندارید. از «وظایف» کارهای مجاز خود را مرور کنید.</Empty>}</section>
   </div>
   <div className="home-v2-secondary">
    <section className="home-v2-panel home-v2-next"><div className="home-v2-section-title"><h2><span className="home-v2-icon blue"><CalendarDays size={23}/></span>برنامه بعدی</h2></div>{nextPlan?<a href={href(nextPlan)} className="home-v2-note blue"><span className="home-v2-icon blue"><CalendarClock size={25}/></span><div><b>{nextPlan.title}</b><small><Clock3 size={13}/>{date(nextPlan.scheduledDate||nextPlan.due)}{nextPlan.startTime?' · '+nextPlan.startTime+(nextPlan.endTime?' تا '+nextPlan.endTime:''):''}</small>{nextPlan.unit&&<small>{nextPlan.unit}</small>}</div><ChevronLeft size={17}/></a>:<Empty>برنامهٔ دیگری در پیش ندارید.<a href="/staff?view=plans">مشاهده تقویم<ArrowLeft size={14}/></a></Empty>}</section>
    <section id="dashboard-notices" className="home-v2-panel home-v2-notice">
     <div className="home-v2-section-title"><h2><span className="home-v2-icon orange"><Bell size={23}/></span>اعلان‌های مهم</h2></div>
     {notices.length?<div className={styles.feed}>{notices.map((notice:any)=><a key={notice.id} href={href({id:notice.record_id})} className="home-v2-note purple"><div><b>{notice.body}</b><small>{new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(notice.created_at))}</small></div><ChevronLeft size={17}/></a>)}</div>:<Empty>اعلان خوانده‌نشده‌ای برای شما وجود ندارد.</Empty>}
    </section>
    {hasAccess(u,'mail')&&<section id="dashboard-management" className="home-v2-panel">
     <div className="home-v2-section-title"><h2><span className="home-v2-icon blue"><Mail size={22}/></span>ابلاغ‌های رئیس پژوهشکده</h2><a href="/work/mail">مکاتبات داخلی<ChevronLeft size={15}/></a></div>
     {management.length?<div className={styles.feed}>{management.map((record:any)=><a key={record.id} href={'/work/mail?id='+encodeURIComponent(record.id)} className="home-v2-note blue"><div><b>{record.title}</b></div><ChevronLeft size={17}/></a>)}</div>:<Empty>پیامی از رئیس پژوهشکده برای شما ثبت نشده است.</Empty>}
    </section>}
   </div>
  </div>
 </main>
}
