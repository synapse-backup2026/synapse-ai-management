'use client';

import {useEffect,useState} from 'react';
import {Bell,ChevronLeft,Clock3,FileText} from 'lucide-react';
import styles from './synapse-dashboard.module.css';

const clock = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const calendar = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'full'});

export default function DashboardSidebar({showManagement,closeMenu}:{showManagement:boolean;closeMenu:()=>void}) {
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{
  const update=()=>setNow(new Date());
  update();
  const timer=window.setInterval(update,1000);
  return ()=>window.clearInterval(timer);
 },[]);
 return <section className={styles.sidebar} aria-label="اطلاعات روز پژوهشکده">
  <div className={styles.clock}>
   <span><Clock3 size={16}/> وقت تهران</span>
   <time dateTime={now?.toISOString()} dir="ltr">{now?clock.format(now):'––:––'}</time>
   <small>{now?calendar.format(now):' '}</small>
  </div>
  <a href="#dashboard-notices" onClick={closeMenu}><Bell size={17}/>اعلان‌های مهم<ChevronLeft size={15}/></a>
  {showManagement&&<a href="#dashboard-management" onClick={closeMenu}><FileText size={17}/>ابلاغ‌های رئیس پژوهشکده<ChevronLeft size={15}/></a>}
 </section>;
}
