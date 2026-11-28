'use client';

import {useEffect,useState} from 'react';
import {Bell,ChevronLeft,Clock3,FileText,Mail,ClipboardList,Thermometer} from 'lucide-react';
import styles from './synapse-dashboard.module.css';

const clock = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const calendar = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',calendar:'persian',weekday:'long',day:'numeric',month:'long',year:'numeric'});

const tehranDay = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
const number = new Intl.NumberFormat('fa-IR',{maximumFractionDigits:0});

export default function DashboardSidebar({showManagement,showDashboard,closeMenu}:{showManagement:boolean;showDashboard:boolean;closeMenu:()=>void}) {
 const [now,setNow]=useState<Date|null>(null);
 const [forecast,setForecast]=useState<{date:string;min:number;max:number}|null>(null);
 const day=now&&tehranDay.format(now);
 useEffect(()=>{
  if(!showDashboard||!day)return;
  const controller=new AbortController();
  const refresh=async()=>{
   try{
    const response=await fetch('/api/dashboard/weather',{signal:controller.signal});
    if(!response.ok)throw new Error();
    setForecast(await response.json() as {date:string;min:number;max:number});
   }catch{
    if(!controller.signal.aborted)setForecast(null);
   }
  };
  void refresh();
  const timer=window.setInterval(refresh,900000);
  return ()=>{controller.abort();window.clearInterval(timer)};
 },[day,showDashboard]);
 useEffect(()=>{
  const update=()=>setNow(new Date());
  update();
  const timer=window.setInterval(update,1000);
  return ()=>window.clearInterval(timer);
 },[]);
 return <section className={styles.sidebar} aria-label="اطلاعات روز پژوهشکده">
  {showDashboard&&<div className={styles.clock}>
   <span><Clock3 size={16}/> وقت تهران</span>
   <time dateTime={now?.toISOString()} dir="ltr">{now?clock.format(now):'––:––:––'}</time>
   <small>{now?calendar.format(now):' '}</small>
   <small><Thermometer size={14}/> {forecast&&forecast.date===day?'دمای امروز تهران، کمینه '+number.format(forecast.min)+'° و بیشینه '+number.format(forecast.max)+'°':'دمای امروز تهران در دسترس نیست'}</small>
  </div>}
  {showDashboard&&<a href="/#dashboard-notices" onClick={closeMenu}><Bell size={17}/>اعلان‌های مهم<ChevronLeft size={15}/></a>}
  {showManagement&&<a href="/#dashboard-management" onClick={closeMenu}><FileText size={17}/>ابلاغ‌های رئیس پژوهشکده<ChevronLeft size={15}/></a>}
  {showDashboard&&<a href="/staff?view=dashboard" onClick={closeMenu}><ClipboardList size={17}/>کارتابل من<ChevronLeft size={15}/></a>}
  {showManagement&&<a href="/work/mail" onClick={closeMenu}><Mail size={17}/>مکاتبات داخلی<ChevronLeft size={15}/></a>}
 </section>;
}
