'use client';
import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {initialSupportData,type SupportWizardData} from '../../types/support-wizard';
import {intakeDefaultResponsibility} from '../../lib/unified-intake-taxonomy';
import {validateStep} from '../../lib/validations/support-wizard-validation';
import {WizardProgress} from './WizardProgress';
import {Step1Category} from './Step1Category';
import {Step2Topic} from './Step2Topic';
import {Step3Details} from './Step3Details';
import {ClipboardList,FlaskConical,Handshake,Phone,Zap} from 'lucide-react';
import {researcherForms,ticketSourceOptions,type WebsiteFormId} from '../../lib/ticket-sources-mapping';
import {SupportChallenge} from './SupportChallenge';
import './support-wizard.css';

type Props={isInternalStaff?:boolean;onCancel?:()=>void;onSaved?:()=>void;publicSiteKey?:string;form?:WebsiteFormId};
type Receipt={id:string;trackingCode:string};
type Upload={file:File;key:string};
type SubmissionResponse={ok?:unknown;id?:unknown;trackingCode?:unknown;error?:unknown};
type Attempt={key:string;data:SupportWizardData;group:string};

export function ResearcherSupportWizard({isInternalStaff=false,onCancel,onSaved,publicSiteKey,form}:Props){
 const profile=form?researcherForms[form]:undefined;
 const topic=profile&&'topic' in profile?profile.topic:'';
 const firstStep=topic?3:profile?.category?2:1;
 const draft=()=>({...initialSupportData(),categoryId:profile?.category||'',topicTitle:topic});
 const publicLive=!!publicSiteKey&&!isInternalStaff;
 const live=isInternalStaff&&!!onSaved||publicLive;
 const [turnstileToken,setTurnstileToken]=useState('');
 const [challengeVersion,setChallengeVersion]=useState(0);
 const [trackingCode,setTrackingCode]=useState('');
 const [trackingStatus,setTrackingStatus]=useState('');
 const [trackingOpen,setTrackingOpen]=useState(false);
 const [step,setStep]=useState(firstStep);
 const [data,setData]=useState(draft);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [receipt,setReceipt]=useState<Receipt>();
 const [pendingFiles,setPendingFiles]=useState<Upload[]>([]);
 const [copied,setCopied]=useState(false);
 const currentAttempt=useRef<Attempt>(null);
 const submitting=useRef(false);
 const locked=busy||!!currentAttempt.current;
 const classification=intakeDefaultResponsibility(data.categoryId,data.topicTitle);
 const updateData=(updates:Partial<SupportWizardData>)=>{setData(old=>({...old,...updates}));setError('')};
 const props={data,updateData,isInternalStaff};

 async function uploadFiles(id:string,files:Upload[]){
  for(const [index,{file,key}] of files.entries()){
   try{
    const form=new FormData();
    form.set('ticket_id',id);
    form.set('file',file);
    form.set('upload_key',key);
    const response=await fetch(publicLive?'/api/ticket-support/public/files':'/api/ticket-support/files',{method:'POST',body:form,headers:publicLive?{'x-support-tracking-code':id}:undefined});
    const result=await response.json() as SubmissionResponse|null;
    if(!response.ok||result?.ok!==true)throw new Error(typeof result?.error==='string'?result.error:'پیوست ذخیره نشد.');
    setPendingFiles(files.slice(index+1));
   }catch(err){
    setError('تیکت ثبت شد. پیوست «'+file.name+'» ذخیره نشد. '+(err instanceof Error?err.message:''));
    return;
   }
  }
 }

 async function submit(){
  if(!live||submitting.current)return;
  if(publicLive&&!turnstileToken){setError('بررسی امنیتی را کامل کنید.');return;}
  const message=validateStep(3,data,isInternalStaff);
  if(message||!classification){setError(message||'موضوع معتبر انتخاب کنید.');return;}
  const attempt=currentAttempt.current??{key:crypto.randomUUID(),data,group:classification.group};
  currentAttempt.current=attempt;
  submitting.current=true;
  setBusy(true);
  setError('');
  try{
   const d=attempt.data;
   const response=await fetch(publicLive?'/api/ticket-support/public':'/api/ticket-support',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     source:publicLive?'site':'direct',turnstileToken,form,group:attempt.group,category:d.categoryId,topic:d.topicTitle,title:d.topicTitle,
     description:d.description,clientName:d.name,phone:d.mobile,email:d.email,reference:d.orderNumber,
     organization:d.organization,due:d.followUpDate,requestKey:attempt.key
    })
   });
   const result=await response.json() as SubmissionResponse|null;
   if(!response.ok){
    if([400,413].includes(response.status))currentAttempt.current=null;
    throw new Error(typeof result?.error==='string'?result.error:'ثبت درخواست انجام نشد.');
   }
   if(result?.ok!==true||typeof result.id!=='string'||!result.id||typeof result.trackingCode!=='string'||!result.trackingCode){
    throw new Error('پاسخ ثبت معتبر نبود. دوباره تلاش کنید.');
   }
   currentAttempt.current=null;
   setReceipt({id:result.id,trackingCode:result.trackingCode});
   setStep(4);
   const uploads=d.files.map(file=>({file,key:crypto.randomUUID()}));
   setPendingFiles(uploads);
   await uploadFiles(result.id,uploads);
   onSaved?.();
  }catch(err){
   setError(err instanceof Error?err.message:'ثبت درخواست انجام نشد.');
  }finally{
   if(publicLive){setTurnstileToken('');setChallengeVersion(v=>v+1);}
   submitting.current=false;
   setBusy(false);
  }
 }

 async function retryFiles(){
  if(!receipt||submitting.current)return;
  submitting.current=true;
  setError('');
  setBusy(true);
  try{await uploadFiles(receipt.id,pendingFiles);onSaved?.();}
  finally{submitting.current=false;setBusy(false);}
 }

 function next(){
  const message=validateStep(step,data,isInternalStaff);
  setError(message);
  if(message)return;
  if(step===3&&live){void submit();return;}
  setStep(s=>Math.min(4,s+1));
 }

 async function track(event:React.FormEvent){
  event.preventDefault();
  setTrackingStatus('در حال بررسی…');
  try{
   const response=await fetch('/api/ticket-support/public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'track',code:trackingCode.trim()})});
   const result=await response.json() as {status?:string;error?:string};
   setTrackingStatus(response.ok?result.status||'پاسخ نامعتبر است.':result.error||'پیگیری ممکن نشد.');
  }catch{setTrackingStatus('پیگیری ممکن نشد. دوباره تلاش کنید.');}
 }

 function reset(){
  setData(draft());
  setReceipt(undefined);
  setPendingFiles([]);
  setCopied(false);
  setError('');
  setStep(firstStep);
 }

 return <section className="sw-root" dir="rtl" aria-label="مرکز پشتیبانی پژوهشگر">
  <header className="sw-header">
   <h1>{isInternalStaff?'ثبت داخلی تیکت پشتیبانی':'مرکز پشتیبانی پژوهشگر'}</h1>
   <p>چطور می‌توانیم کمکتان کنیم؟</p>
   {isInternalStaff&&<small>ثبت داخلی سامانه</small>}
  </header>
  <div className="sw-body">
   {publicLive&&<button type="button" onClick={()=>{setTrackingOpen(v=>!v);setTrackingStatus('')}}>{trackingOpen?'بازگشت به ثبت درخواست':'پیگیری درخواست'}</button>}
   {trackingOpen?<form className="sw-fields" onSubmit={track}>
    <label>کد پیگیری<input required maxLength={36} dir="ltr" value={trackingCode} onChange={e=>setTrackingCode(e.target.value)}/></label>
    <button type="submit" className="sw-primary">مشاهده وضعیت</button>
    <p role="status">{trackingStatus}</p>
   </form>:<>
   {!isInternalStaff&&<nav className="sw-entry-links" aria-label="فرم‌های پژوهشگر">
    {[{id:'',Icon:ClipboardList},{id:'research_order',Icon:FlaskConical},{id:'collaboration',Icon:Handshake},{id:'quick_request',Icon:Zap},{id:'contact',Icon:Phone}].map(({id,Icon})=>id?<button key={id} type="button" disabled><Icon size={14}/>{ticketSourceOptions.find(x=>x.id===id)?.label}</button>:<a key={id} href="/support" aria-current="page"><Icon size={14}/>تیکت پشتیبانی</a>)}
   </nav>}
   {profile&&<p className="sw-unit">{profile.description}</p>}
   <div className={step<4?'sw-progress-actions':undefined}>
    <WizardProgress currentStep={step} received={!!receipt}/>
    {step<4&&<button type="button" className="sw-primary sw-category-continue" disabled={busy||(step===1&&!data.categoryId)||(step===2&&!classification)} onClick={next}>
     {busy?'در حال ثبت…':step===1?'ادامه و انتخاب موضوع':step===2?'ادامه و تکمیل اطلاعات درخواست':live?'ثبت درخواست و دریافت کد پیگیری':'مشاهده مرحله دریافت کد پیگیری'}<ChevronLeft size={16}/>
    </button>}
   </div>
   {error&&<p className="sw-error" role="alert">{error}</p>}
   <div className="sw-research-layout" data-stage={step}>
    {step===1&&<Step1Category {...props}/>}
    {step===2&&<div className="sw-group services sw-topic-stage"><Step2Topic {...props}/></div>}
    {step>=3&&<aside className="sw-selected-topic"><h2>موضوع درخواست</h2><strong>{data.topicTitle}</strong>{classification&&<p>{classification.label}</p>}</aside>}
    <section className="sw-blue-information" aria-label="اطلاعات درخواست">
     {step<3&&<fieldset disabled><legend>تکمیل اطلاعات</legend>
      <p>این بخش در مرحلهٔ سوم فعال می‌شود.</p>
      <div className="sw-fields">
       <label>نام و نام خانوادگی<input placeholder="نام محقق"/></label>
       <label>شماره موبایل<input placeholder="شماره تماس"/></label>
       <label>ایمیل<input placeholder="آدرس ایمیل"/></label>
       <label>شماره فاکتور یا سفارش<input placeholder="اختیاری"/></label>
       <label className="sw-wide">شرح درخواست<textarea rows={2}/></label>
      </div>
     </fieldset>}
     {step===3&&<fieldset disabled={locked}>
      <Step3Details {...props} live={live}/>
     </fieldset>}
   {step===4&&(receipt?<section className="sw-notice">
    <h2>درخواست با موفقیت ثبت شد</h2>
    <p>واحد پاسخگو {classification?.label}</p>
    {publicLive&&<p>کد پیگیری را برای مشاهده وضعیت درخواست نگه دارید.</p>}
    <p><strong>کد پیگیری </strong><bdi>{receipt.trackingCode}</bdi></p>
    <button type="button" onClick={async()=>{
     try{await navigator.clipboard.writeText(receipt.trackingCode);setCopied(true);}
     catch{setCopied(false);}
    }}>{copied?'کد کپی شد':'کپی کد پیگیری'}</button>
    {pendingFiles.length>0&&<p>{busy?'در حال ذخیره پیوست‌ها…':'تعدادی از پیوست‌ها هنوز ذخیره نشده‌اند.'}</p>}
   </section>:<section><h2>دریافت کد پیگیری</h2>
    <p className="sw-notice" role="status">فرم عمومی در حالت پیش‌نمایش است. اطلاعاتی به سرور ارسال نشده است.</p>
   </section>)}
    </section>
   </div>
   {publicLive&&step===3&&<SupportChallenge key={challengeVersion} siteKey={publicSiteKey} onToken={setTurnstileToken}/>}
   {(step>1||onCancel)&&<nav className="sw-nav" aria-label="حرکت بین مراحل">
    {!receipt&&step>1&&<button type="button" disabled={step===firstStep||locked} onClick={()=>{setError('');setStep(s=>Math.max(firstStep,s-1));}}><ChevronRight size={16}/> مرحله قبل</button>}
    {onCancel&&<button type="button" disabled={busy} onClick={onCancel}>بازگشت</button>}
    {receipt&&pendingFiles.length>0&&<button type="button" className="sw-primary" disabled={busy} onClick={()=>void retryFiles()}>تلاش مجدد برای پیوست‌ها</button>}
    {receipt&&<button type="button" disabled={busy} onClick={reset}>ثبت درخواست دیگر</button>}
   </nav>}</>}
  </div>
 </section>;
}
