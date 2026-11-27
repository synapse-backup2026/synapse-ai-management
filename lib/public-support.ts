import {check,limitedText} from './integration-store';
import {requestOrigin} from './request-origin';
import {digest,rateAllowed} from './staff-auth';
import {db} from './staff-server';

export const publicSupportAction='support_ticket';
export const supportUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function publicSupportSiteKey(){
 const {SYNAPSE_SUPPORT_PUBLIC,SYNAPSE_SUPPORT_TURNSTILE_KEY,SYNAPSE_SUPPORT_TURNSTILE_SECRET,SYNAPSE_PUBLIC_ORIGIN}=process.env;
 return SYNAPSE_SUPPORT_PUBLIC==='1'&&SYNAPSE_SUPPORT_TURNSTILE_SECRET&&SYNAPSE_PUBLIC_ORIGIN&&SYNAPSE_SUPPORT_TURNSTILE_KEY||'';
}

export function requirePublicSupport(req:Request){
 check(publicSupportSiteKey(),'ثبت عمومی هنوز فعال نشده است.',503);
 check(req.headers.get('origin')===requestOrigin(req),'درخواست نامعتبر است.',403);
}

export async function supportPublicBody(req:Request){
 requirePublicSupport(req);
 const raw=await limitedText(req,128*1024);
 try{return JSON.parse(raw)}catch{check(false,'فرمت درخواست معتبر نیست.',400);}
}

export async function verifyPublicSupport(token:unknown){
 check(typeof token==='string'&&token.length>0&&token.length<=2048,'بررسی امنیتی را کامل کنید.',400);
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
  method:'POST',
  body:new URLSearchParams({secret:process.env.SYNAPSE_SUPPORT_TURNSTILE_SECRET!,response:String(token)}),
  signal:AbortSignal.timeout(8000)
 }).catch(()=>null);
 check(response?.ok,'سرویس بررسی امنیتی در دسترس نیست.',503);
 const result=await response!.json() as {success?:boolean;hostname?:string;action?:string};
 check(result.success===true&&result.action===publicSupportAction&&result.hostname===new URL(process.env.SYNAPSE_PUBLIC_ORIGIN!).hostname,'بررسی امنیتی معتبر نیست. دوباره تلاش کنید.',400);
}

export async function publicSupportLimit(scope:string,key:string,max:number){
 check(await rateAllowed('support:'+scope+':'+await digest(key.toLowerCase()),max),'تعداد درخواست‌ها بیش از حد مجاز است. بعداً دوباره تلاش کنید.',429);
}

export async function publicSupportRecord(id:string){
 if(!supportUuid.test(id))return null;
 return db().prepare("SELECT id,request_state,status FROM ops_items WHERE id=? AND archived_at IS NULL AND CAST(json_extract(source_labels,'$.ticket_public') AS TEXT)='1'").bind(id.toLowerCase()).first<{id:string;request_state:string;status:string}>();
}
