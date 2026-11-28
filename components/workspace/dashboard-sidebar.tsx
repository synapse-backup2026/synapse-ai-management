'use client';

import {useEffect,useState} from 'react';
import {Bell,ChevronLeft,Clock3,FileText,Cloud,CloudFog,CloudLightning,CloudRain,CloudSnow,Sun} from 'lucide-react';
import styles from './synapse-dashboard.module.css';

const clock = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const calendar = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',calendar:'persian',weekday:'long',day:'numeric',month:'long',year:'numeric'});

const tehranDay = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
function formatDate(now:Date) {
 const parts=calendar.formatToParts(now);
 const part=(type:string)=>parts.find(item=>item.type===type)?.value;
 return [part('weekday'),part('day'),part('month'),part('year')].join(' ');
}

function weather(code:number) {
 if(code===0)return {Icon:Sun,label:'آفتابی',tone:'sunny'};
 if(code<=3)return {Icon:Cloud,label:'ابری',tone:'cloudy'};
 if(code<=48)return {Icon:CloudFog,label:'مه‌آلود',tone:'cloudy'};
 if((code>=71&&code<=77)||code===85||code===86)return {Icon:CloudSnow,label:'برفی',tone:'cloudy'};
 if(code>=95)return {Icon:CloudLightning,label:'رعدوبرق',tone:'rainy'};
 return {Icon:CloudRain,label:'بارانی',tone:'rainy'};
}

const number = new Intl.NumberFormat('fa-IR',{maximumFractionDigits:0});

export default function DashboardSidebar({showManagement,showDashboard,closeMenu}:{showManagement:boolean;showDashboard:boolean;closeMenu:()=>void}) {
 const [now,setNow]=useState<Date|null>(null);
 const [forecast,setForecast]=useState<{date:string;min:number;max:number;code:number}|null>(null);
 const day=now&&tehranDay.format(now);
 useEffect(()=>{
  if(!showDashboard||!day)return;
  const controller=new AbortController();
  const refresh=async()=>{
   try{
    const response=await fetch('/api/dashboard/weather',{signal:controller.signal});
    if(!response.ok)throw new Error();
    setForecast(await response.json() as {date:string;min:number;max:number;code:number});
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
 const today=forecast?.date===day?forecast:null;
 const condition=today?weather(today.code):null;
 return <section className={styles.sidebar} aria-label="اطلاعات روز پژوهشکده">
  {showDashboard&&<div className={styles.clock}>
   <span><Clock3 size={16}/> وقت تهران</span>
   <time dateTime={now?.toISOString()} dir="ltr">{now?clock.format(now):'––:––:––'}</time>
   <small>{now?formatDate(now):' '}</small>
   <small className={styles.weather} data-tone={condition?.tone}>
    {condition&&<condition.Icon size={17} role="img" aria-label={condition.label}/>}
    <span>دمای امروز</span>
    {today?<bdi aria-label={`کمینه ${number.format(today.min)}، بیشینه ${number.format(today.max)} درجهٔ سانتی‌گراد`}>{number.format(today.min)}° / {number.format(today.max)}°</bdi>:<span aria-label="در دسترس نیست">—</span>}
   </small>
  </div>}
  {showDashboard&&<a href="/#dashboard-notices" onClick={closeMenu}><Bell size={17}/>اعلان‌های مهم<ChevronLeft size={15}/></a>}
  {showManagement&&<a href="/#dashboard-management" onClick={closeMenu}><FileText size={17}/>ابلاغ‌های رئیس پژوهشکده<ChevronLeft size={15}/></a>}
 </section>;
}
