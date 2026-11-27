import {OperationHistory} from './operation-history';
import Link from 'next/link';
import {Phone} from 'lucide-react';
import {communicationChannels} from '../../lib/communication-policy';
import {receiptDateLabel} from '../../lib/operations-date-filter';

type Message={id:string;direction:string;body:string;delivery_status:string;created_by:string;created_at:string};
type Event={id:string;action:string;body:string;actor:string;created_at:string};
type Props={
 item:any; ready:boolean; sourceVisible:boolean; communications:Message[]; events:Event[];
 responsibility?:string; assignedTo:string; nameOf:(id:string)=>string; phoneHref:(number:string)=>string;
 canOpenLab:boolean; canDraft:boolean; busy:boolean; feedback:string; comment:string;
 onComment:(text:string)=>void; onHistory:()=>void; onReply:(draft:boolean)=>Promise<void>;
};

const messageDate=new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tehran'});
function formatDate(value:string){
 const stamp=new Date(value);
 return Number.isFinite(stamp.getTime())?messageDate.format(stamp):'';
}

export default function OperationsConversation({item,ready,sourceVisible,communications,events,responsibility,assignedTo,nameOf,phoneHref,canOpenLab,canDraft,busy,feedback,comment,onComment,onHistory,onReply}:Props){
 if(!ready)return <p role={feedback?'alert':'status'}>{feedback||'در حال دریافت پیام…'}</p>;
 if(!sourceVisible)return <p>متن این پیام فقط برای واحد مجاز قابل مشاهده است.</p>;

 const original=item.sourceBody?.trim();
 const channel=communicationChannels.find(c=>c.id===item.channel)?.name;
 const contact=item.email||item.phone;
 const source=/^https?:\/\//i.test(item.sourceUrl||'')?item.sourceUrl:'';
 const phone=phoneHref(item.phone);
 const originalIndex=communications.findIndex(message=>message.direction===(item.direction||'inbound')&&message.body?.trim()===original);
 const thread=[
  ...communications.filter((message,index)=>index!==originalIndex&&message.body?.trim()).map(message=>({
   id:message.id,
   body:message.body,
   kind:message.direction==='inbound'?'inbound':message.direction==='internal'?'internal':message.delivery_status==='draft'?'draft':message.delivery_status==='sent'?'sent':'outbound',
   actor:message.direction==='inbound'?item.clientName||'مخاطب':nameOf(message.created_by),
   at:message.created_at,
  })),
  ...events.filter(event=>event.action==='comment'&&event.body?.trim()).map(event=>({id:event.id,body:event.body,kind:'internal',actor:nameOf(event.actor),at:event.created_at})),
 ].sort((a,b)=>a.at.localeCompare(b.at));
 const kinds:Record<string,string>={inbound:'پیام مخاطب',internal:'یادداشت داخلی',draft:'پیش‌نویس پاسخ',sent:'پاسخ ارسال‌شده',outbound:'پاسخ ثبت‌شده'};
 return <div className="ops-conversation">
  <div className="ops-contact-bar">
   <strong dir="auto">{item.clientName||'مخاطب'}</strong>
   {phone?<a href={phone} dir="ltr"><Phone size={13}/>{item.phone}</a>:item.phone&&<bdi>{item.phone}</bdi>}
   {item.email&&<bdi>{item.email}</bdi>}
   {item.reference&&<span>شماره سفارش <bdi>{item.reference}</bdi></span>}
   <span className="ops-conversation-role">{[...new Set([responsibility,assignedTo].filter(Boolean))].join(' · ')}</span>
  </div>

  <div className="ops-thread" aria-label="گفتگوی پیام">
   <article className="ops-message" data-kind="original">
    <header><strong>{item.direction==='outbound'?'پیام ارسالی':'پیام اصلی'}</strong><small>{[channel,receiptDateLabel(item)].filter(Boolean).join(' · ')}</small></header>
    <p dir="auto">{original||'متن پیام ثبت نشده است.'}</p>
    {item.attachments?.length>0&&<ul className="ops-message-files">{item.attachments.map((a:any,i:number)=><li key={i}>{a.id&&[1,2].includes(Number(item.sourceLabels?.ticket_v))?
     <a href={'/api/ticket-support/files?ticket_id='+encodeURIComponent(item.id)+'&file_id='+encodeURIComponent(a.id)}>{a.filename||'پیوست خصوصی'}</a>:
     a.filename||a.name||'پیوست'}</li>)}</ul>}
   </article>
   <nav className="ops-message-links" aria-label="پیوندهای پیام">
    {source&&<a href={source} target="_blank" rel="noopener noreferrer">باز کردن منبع اصلی ↗</a>}
    {canOpenLab&&<Link href={'/laboratories?operation='+encodeURIComponent(item.id)}>پرونده آزمایشگاهی و پذیرش نمونه</Link>}
    {contact&&<Link onClick={onHistory} href={'/operations?view=history&contact='+encodeURIComponent(contact)}>سوابق همین مشتری</Link>}
   </nav>
   {thread.map(message=><article className="ops-message" data-kind={message.kind} key={message.id}>
    <header><strong>{kinds[message.kind]} · {message.actor}</strong><small>{formatDate(message.at)}</small></header>
    <p dir="auto">{message.body}</p>
   </article>)}
  </div>

  <form className="ops-reply" onSubmit={e=>{e.preventDefault();void onReply(canDraft)}}>
   <label htmlFor="ops-reply-body">{canDraft?'پاسخ به پیام':'یادداشت داخلی دربارهٔ پیام'}</label>
   <textarea id="ops-reply-body" required rows={3} maxLength={12000} value={comment} onChange={e=>onComment(e.target.value)}/>
   <div className="ops-reply-actions">
    <button className="primary" disabled={busy||!comment.trim()}>{canDraft?'ذخیره پیش‌نویس پاسخ':'ثبت یادداشت داخلی'}</button>
    {canDraft&&<button className="secondary" type="button" disabled={busy||!comment.trim()} onClick={()=>void onReply(false)}>ثبت یادداشت داخلی</button>}
    {source&&<a href={source} target="_blank" rel="noopener noreferrer">پاسخ در کانال اصلی ↗</a>}
   </div>
   {feedback&&<p role="alert" className="error-banner">{feedback}</p>}
  </form>
  <OperationHistory events={events}/>
 </div>;
}
