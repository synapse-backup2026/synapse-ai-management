const labels:Record<string,string>={
 'dispatch-received':'دریافت ارتباط','dispatch-route':'تغییر مسیر درخواست','dispatch-update':'به‌روزرسانی پیگیری','dispatch-status':'به‌روزرسانی وضعیت',
 'dispatch-reply-draft':'ذخیره پیش‌نویس پاسخ','dispatch-reply-approved':'تأیید پاسخ',
 'dispatch-reply-sent':'ثبت ارسال انجام‌شده','dispatch-case-linked':'اتصال پرونده مرکزی',
 'ops-update':'به‌روزرسانی پیگیری','ops-manual-assign':'ارجاع به مسئول پیگیری',
 'ops-owner-accepted':'تأیید پذیرش','ops-owner-accept':'تأیید پذیرش'
};
const date=new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'});
export function OperationHistory({events}:{events:{id:string;action:string;created_at:string;body:string}[]}){
 const visible=events.filter(event=>labels[event.action]).slice().reverse();
 return <details className="ops-workflow-history">
  <summary>تاریخچه اقدامات ({visible.length.toLocaleString('fa-IR')})</summary>
  {visible.length?<ol>{visible.map(event=>{
   const stamp=new Date(event.created_at);
   let reason='';
   if(['dispatch-route','ops-manual-assign'].includes(event.action)){try{reason=JSON.parse(event.body).reason||''}catch{}}
   return <li key={event.id}><strong>{labels[event.action]}</strong>
    {Number.isFinite(stamp.getTime())&&<time dateTime={stamp.toISOString()}>{date.format(stamp)}</time>}
    {reason&&<p>{reason}</p>}
   </li>;
  })}</ol>:<p>اقدامی برای این درخواست ثبت نشده است.</p>}
 </details>;
}
