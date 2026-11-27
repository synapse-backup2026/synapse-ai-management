import {inputRange,inputTimestamp} from './input-window';
import {requestOrigin} from './request-origin';
import {digest} from './staff-auth';
import {legacyCallEvents} from './call-sheet-adapter';
import {env} from 'cloudflare:workers';
import {db} from './staff-server';
import {check,setting,storeSetting,seal,unseal,stamp,audit} from './integration-store';
import {source,ingest,InputSource,healthError} from './input-sources';
const e=()=>env as any;
const scope=(s:InputSource)=>s.method==='gmail_oauth'?'https://www.googleapis.com/auth/gmail.readonly':'https://www.googleapis.com/auth/spreadsheets.readonly';
// In a reverse-proxied Hostinger deployment, the internal request URL may not match the public OAuth redirect URI.
const callback=(req:Request)=>new URL('/api/integrations/google/callback',requestOrigin(req)).href;
async function google(url:string,init:any={}){const r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(20000)});check(r.ok,'سرویس گوگل خطا داد؛ مجوز، حساب یا دسترسی API را بررسی کنید.',502);return await r.json() as any}
export async function googleStart(req:Request,s:InputSource){check(s.revision>0,'ابتدا تنظیمات منبع را ذخیره کنید.',409);check(['gmail_oauth','google_sheets'].includes(s.method),'این منبع اتصال گوگل ندارد.');check(e().GOOGLE_OAUTH_CLIENT_ID&&e().GOOGLE_OAUTH_CLIENT_SECRET,'Secretهای OAuth گوگل تنظیم نشده‌اند.',503);const state=crypto.randomUUID(),verifier=crypto.randomUUID()+crypto.randomUUID(),challenge= btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 await storeSetting('input-oauth:'+state,{source:s.id,revision:s.revision,expires:Date.now()+600000,verifier:await seal('oauth:'+state,verifier)}).run();const p=new URLSearchParams({client_id:e().GOOGLE_OAUTH_CLIENT_ID,redirect_uri:callback(req),response_type:'code',scope:scope(s),access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256',...(s.address?{login_hint:s.address}:{})});return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+p}}
export async function googleCallback(req:Request){const p=new URL(req.url).searchParams,state=p.get('state')||'';check(/^[a-f0-9-]{36}$/.test(state),'درخواست OAuth معتبر نیست.');const session=await setting('input-oauth:'+state);check(session&&session.expires>Date.now()&&p.get('code'),'مجوز منقضی یا رد شده است.');const consumed=await db().prepare('DELETE FROM staff_auth_settings WHERE id=? AND value=?').bind('input-oauth:'+state,JSON.stringify(session)).run();check(consumed.meta.changes,'درخواست قبلاً مصرف شده است.',409);const s=await source(session.source);check(s&&s.revision===session.revision,'تنظیمات منبع تغییر کرده است.',409);
 const token=await google('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e().GOOGLE_OAUTH_CLIENT_ID,client_secret:e().GOOGLE_OAUTH_CLIENT_SECRET,code:p.get('code')!,redirect_uri:callback(req),grant_type:'authorization_code',code_verifier:await unseal('oauth:'+state,session.verifier)})});check(token.refresh_token&&String(token.scope||'').split(' ').includes(scope(s!)),'دسترسی آفلاین لازم اعطا نشد؛ اتصال را با رضایت کامل تکرار کنید.',409);
 if(s!.method==='gmail_oauth'){const profile=await google('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+token.access_token}});check(!s!.address||profile.emailAddress?.toLowerCase()===s!.address.toLowerCase(),'حساب انتخاب‌شده با نشانی منبع یکسان نیست.',409);s!.address=profile.emailAddress;}
 s!.secret=await seal('input-source:'+s!.id,token.refresh_token);s!.revision++;const written=await db().prepare("UPDATE staff_auth_settings SET value=? WHERE id=? AND json_extract(value,'$.revision')=?").bind(JSON.stringify(s),'input-source:'+s!.id,session.revision).run();check(written.meta.changes,'ابتدا منبع را ذخیره کنید؛ یا تنظیمات هم‌زمان تغییر کرده است.',409);return Response.redirect(new URL('/manage/connections?connected='+s!.id,requestOrigin(req)).href,303)}
async function access(s:InputSource){check(googleReadiness().ready,'Secretهای OAuth گوگل یا رمزگذاری تنظیم نشده‌اند.',503);check(s.secret,'ابتدا OAuth منبع را متصل کنید.',409);return (await google('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e().GOOGLE_OAUTH_CLIENT_ID,client_secret:e().GOOGLE_OAUTH_CLIENT_SECRET,refresh_token:await unseal('input-source:'+s.id,s.secret),grant_type:'refresh_token'})})).access_token}
export function gmailEvent(m:any){const headers=m.payload?.headers||[],h=(name:string)=>headers.find((h:any)=>h.name.toLowerCase()===name.toLowerCase())?.value||'';let text='';const walk=(p:any)=>{if(p.mimeType==='text/plain'&&p.body?.data&&p.body.data.length<=32000){try{text+='\n'+new TextDecoder().decode(Uint8Array.from(atob(p.body.data.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))}catch{}}for(const n of p.parts||[])walk(n)};walk(m.payload||{});const from=h('From'),email=(from.match(/<([^>]+)>/)||[])[1]||from;return {eventId:String(m.id),title:h('Subject').slice(0,240),body:(text.trim()||String(m.snippet||'')).slice(0,16000),email,clientName:from.replace(/<.*>/,'').trim(),at:Number.isFinite(Number(m.internalDate))?new Date(Number(m.internalDate)).toISOString():'',url:'https://mail.google.com/mail/u/0/#all/'+m.id,attachments:(m.payload?.parts||[]).filter((p:any)=>p.filename).map((p:any)=>({name:p.filename}))}}
export function sheetEvents(values:any[][]){const [heads,...rows]=values;if(!heads)return [];const keys=heads.map(v=>String(v).trim());const index=(names:string[])=>keys.findIndex(h=>names.includes(h));const id=index(['event_id','شناسه رویداد']),date=index(['date','تاریخ']),name=index(['clientName','نام']),phone=index(['phone','شماره تماس']),email=index(['email','ایمیل']),ref=index(['reference','شماره فاکتور']),title=index(['title','عنوان']),body=index(['body','توضیحات تماس گیرنده']);check(id>=0&&date>=0&&title>=0&&body>=0,'ستون‌های شناسه رویداد، تاریخ ISO، عنوان و توضیحات لازم‌اند؛ شیت اصلی خودکار تغییر نمی‌کند.',409);return rows.filter(r=>r.some(Boolean)).map(r=>({eventId:String(r[id]||''),at:String(r[date]||''),clientName:String(r[name]||''),phone:String(r[phone]||''),email:String(r[email]||''),reference:String(r[ref]||''),title:String(r[title]||''),body:String(r[body]||'')}))}
export function googleReadiness(){return {ready:!!(e().GOOGLE_OAUTH_CLIENT_ID&&e().GOOGLE_OAUTH_CLIENT_SECRET&&typeof e().SYNAPSE_INTEGRATION_KEY==='string'&&e().SYNAPSE_INTEGRATION_KEY.length>=32),clientId:!!e().GOOGLE_OAUTH_CLIENT_ID,clientSecret:!!e().GOOGLE_OAUTH_CLIENT_SECRET,automationToken:!!e().SYNAPSE_AUTOMATION_TOKEN}}
export async function googleLabels(s:InputSource){check(s.method==='gmail_oauth','فقط صندوق Gmail برچسب دارد.');const token=await access(s);const list=await google('https://gmail.googleapis.com/gmail/v1/users/me/labels',{headers:{Authorization:'Bearer '+token}});return {labels:(list.labels||[]).map((l:any)=>({id:l.id,name:l.name}))}}
export async function googleDisconnect(u:any,s:InputSource,revision:number){check(['gmail_oauth','google_sheets'].includes(s.method),'این منبع اتصال OAuth ندارد.');check(revision===s.revision,'منبع هم‌زمان تغییر کرده است.',409);const next={...s,enabled:false,revision:s.revision+1};delete next.secret;const result=await db().prepare("UPDATE staff_auth_settings SET value=? WHERE id=? AND json_extract(value,'$.revision')=?").bind(JSON.stringify(next),'input-source:'+s.id,s.revision).run();check(result.meta.changes,'منبع هم‌زمان تغییر کرده است.',409);await storeSetting('input-health:'+s.id,{...await setting('input-health:'+s.id,{}),status:'disconnected',error:'',cursor:''}).run();await audit(u,s.id,'google-disconnected',{revision:next.revision});return {ok:true,message:'اتصال محلی قطع شد؛ داده‌ها حفظ شدند. لغو مجوز در حساب Google اقدام جداگانه مالک است.'}}
export async function googlePoll(s:InputSource,probe=false){
 const leaseKey='input-lease:'+s.id,lease={token:crypto.randomUUID(),expires:Date.now()+900000};
 const locked=await db().prepare("INSERT INTO staff_auth_settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE json_extract(staff_auth_settings.value,'$.expires')<=?").bind(leaseKey,JSON.stringify(lease),Date.now()).run();
 check(locked.meta.changes,'این منبع در حال پردازش است؛ اجرای هم‌زمان مجاز نیست.',409);
 try{
  const current=await source(s.id);check(current?.revision===s.revision,'تنظیمات منبع تغییر کرده است.',409);
  check(probe||s.enabled,'منبع غیرفعال است.',409);
  const start=s.notBefore||stamp().slice(0,10);check(inputRange(start,s.notAfter),'محدوده تاریخی منبع معتبر نیست.',409);
  const token=await access(s),headers={Authorization:'Bearer '+token};
  if(probe){if(s.method==='gmail_oauth'){const p=await google('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers});check(p.emailAddress?.toLowerCase()===s.address.toLowerCase(),'حساب با نشانی منبع یکسان نیست.',409)}else await google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(s.sheetId!)+'?fields=spreadsheetId',{headers});await storeSetting('input-health:'+s.id,{...await setting('input-health:'+s.id,{}),status:'authorized',testedRevision:s.revision,lastProbe:stamp(),error:''}).run();return {ok:true,readOnly:true,imported:false}}
  const health=await setting('input-health:'+s.id,{}),same=health.sourceRevision===s.revision;
  let count=0,next='',checkpoint:any={},skipped:any={},created=0,replayed=0;
  const consume=async(events:any[])=>{const result=await ingest(s,events);for(const r of result.results){if(r.skipped)skipped[r.skipped]=(skipped[r.skipped]||0)+1;else if(r.replayed)replayed++;else if(r.id)created++;}count+=events.length;};
  if(s.method==='gmail_oauth'){
   const lower=Date.parse(start+'T00:00:00Z'),upper=s.notAfter?Date.parse(s.notAfter+'T00:00:00Z')+86400000:Infinity;
   const windowStart=same&&health.cursor?health.windowStart:Math.max(lower,same&&health.completedThrough?health.completedThrough-60000:lower);
   const windowEnd=same&&health.cursor?health.windowEnd:Math.min(upper,Date.now()+1000);
   if(windowStart<windowEnd){
    const p=new URLSearchParams({maxResults:'25',q:'('+String(s.query||'-in:spam -in:trash')+') after:'+Math.floor(windowStart/1000)+' before:'+Math.ceil(windowEnd/1000),...(same&&health.cursor?{pageToken:health.cursor}:{})});
    for(const label of s.labels||[])p.append('labelIds',label);
    const list=await google('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+p,{headers});
    for(const message of list.messages||[]){const m=await google('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(message.id)+'?format=full',{headers});const event=gmailEvent(m);check(inputTimestamp(event.at),'زمان ایمیل معتبر نیست.',409);if(Date.parse(event.at)<lower||Date.parse(event.at)>=upper)continue;await consume([event]);}
    next=list.nextPageToken||'';
   }
   checkpoint={windowStart,windowEnd,completedThrough:next?(same?health.completedThrough:undefined):windowEnd};
  }else{
   const data=await google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(s.sheetId!)+'/values/'+encodeURIComponent(s.range!),{headers}),rows=data.values||[];
   const legacy=String(rows[0]?.[0]||'').trim()==='ردیف'?legacyCallEvents(rows,start):null;
   const raw=legacy?legacy.events:sheetEvents(rows);skipped=legacy?.skipped||{};
   // Validate the entire selected source before the first operation is written.
   for(const event of raw){const iso=inputTimestamp(event.at);check(!!iso&&Date.parse(iso)<=Date.now()+300000,'تاریخ شیت نامعتبر یا در آینده است؛ پیش از ورود اصلاح شود.',409);event.at=iso;}
   const events=raw.filter((event:any)=>event.at.slice(0,10)>=start&&(!s.notAfter||event.at.slice(0,10)<=s.notAfter));
   const hash=await digest(JSON.stringify(rows)),offset=same&&health.sheetHash===hash?Number(health.sheetOffset||0):0;
   const page=events.slice(offset,offset+100);await consume(page);
   const end=offset+page.length;next=end<events.length?String(end):'';checkpoint={sheetHash:hash,sheetOffset:end,eligible:events.length};
  }
  await storeSetting('input-health:'+s.id,{...health,...checkpoint,status:'synced',sourceRevision:s.revision,testedRevision:s.revision,lastSuccess:stamp(),cursor:next,error:'',events:count,created,replayed,skipped}).run();
  return {ok:true,events:count,created,replayed,skipped,more:!!next};
 }catch(error){await healthError(s.id,'google-access-or-input-error');throw error}
 finally{await db().prepare('DELETE FROM staff_auth_settings WHERE id=? AND value=?').bind(leaseKey,JSON.stringify(lease)).run();}
}
