'use client';
import {useEffect,useState} from 'react';
import AccountTransferPanel from '../../components/workspace/account-transfer-panel';
import {roleTitle,organizationCatalog} from '../../lib/org-role-catalog';
import {approvedAccountOverview,sharedStaffSurfaces} from '../../lib/approved-account-responsibilities';
import './accounts-accordion.css';
export default function AccountsApp({initialData=null}:{initialData?:any}={}){
 const [data,setData]=useState<any>(initialData),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[credentials,setCredentials]=useState<Record<string,any>>({});
 async function load(){const r=await fetch('/api/auth/accounts',{cache:'no-store'}),d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d)}
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 async function action(body:any){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/auth/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error);if(d.credential)setCredentials(old=>({...old,[d.credential.username]:d.credential}));await load();setNotice(body.action==='managed_reset'?'رمز جدید ذخیره و نشست‌های قبلی نامعتبر شدند.':'اطلاعات حساب ذخیره شد.');return true}catch(e:any){setError(e.message);return false}finally{setBusy(false)}}
 async function copy(username:string){setBusy(true);setError('');try{const cached=credentials[username];if(cached?.password){await navigator.clipboard.writeText(cached.password);setNotice('رمز اولیه '+username+' کپی شد.');return}const r=await fetch('/api/auth/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'initial_credentials'})}),d:any=await r.json();if(!r.ok)throw Error(d.error);const c=d.initial_credentials.find((x:any)=>x.username===username);if(!c?.password)throw Error(c?.note||'رمز اولیه موجود نیست؛ از تنظیم رمز استفاده کنید.');setCredentials(old=>({...old,[username]:c}));try{await navigator.clipboard.writeText(c.password)}catch{throw Error('رمز آماده شد؛ برای کپی امن، دوباره دکمه کپی رمز جدید را بزنید.')}setNotice('رمز اولیه '+username+' کپی شد. آن را فقط از مسیر امن تحویل دهید.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <main className="accounts-page nine-accounts-page" dir="rtl"><a href="/staff">بازگشت به کارتابل</a><header className="page-heading"><div><h1>حساب‌های سازمانی</h1><p>فهرست مسئولیت‌های مصوب و حساب‌های فعلی؛ نام ورود، هویت فرد و سوابق حساب مستقل از عنوان سمت هستند.</p></div><span className="nine-account-count">۹ مسئولیت مصوب</span></header>{error&&<p className="error-banner" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}{!data?<p>در حال دریافت حساب‌ها…</p>:<><AccountTransferPanel onDone={load}/><section className="synapse-account-guide"><h2>حوزه‌های مسئولیت و دسترسی سازمانی</h2><p>برای مشاهده شرح وظایف، حدود اختیارات، محدودیت‌ها و صفحات مجاز روی فلش هر نوار کلیک کنید. نام کاربری، شناسه و سابقه ورود حفظ می‌شود.</p><p><b>دسترسی‌های مشترک:</b> {sharedStaffSurfaces.join(' · ')}؛ مشاهده هر پرونده و مکاتبه تابع مجوز فرد و نقش در همان پرونده است.</p></section><section className="synapse-accounts-list" aria-label="حساب‌های سازمانی">{['owner','executive','research','scientific','customer','finance','admin','it'].map(username=>data.organization_accounts.find((a:any)=>a.username===username)).filter(Boolean).map((a:any)=><OrganizationAccount key={a.username} a={a} minimum={data.password_minimum} busy={busy} action={action} copy={copy} credential={credentials[a.username]} clear={()=>setCredentials(old=>{const next={...old};delete next[a.username];return next})}/>)}
<OrganizationAccount
 a={{...data.accountant, username:'accountant', exists:!!data.accountant, access:[], definition:{
  role_key:'accountant',
  title_fa:'کارشناس حسابداری',
  title_en:'Accounting Specialist',
  reports_to:'finance_manager',
  duties:['ثبت دریافت‌ها و پرداخت‌ها و پیگیری اسناد حسابداری','بررسی مغایرت واریزی‌ها و تهیه گزارش برای مدیر مالی'],
  authority:['ثبت اسناد جدید در محدوده مالی مجاز','مشاهده گردش حساب بانکی و تعرفه‌ها پس از فعال شدن مجوزهای مالی'],
  requires_approval:['اصلاح رکورد موجود نیازمند تأیید مدیریت است','حذف، تأیید نهایی مالی و تغییر اطلاعات بانکی یا تعرفه مجاز نیست']
 }}}
 minimum={data.password_minimum} busy={busy} action={action} copy={copy}
 credential={credentials.accountant}
 clear={()=>setCredentials(({accountant: _accountant,...others})=>others)}
/>
</section><details className="panel nine-legacy"><summary>حساب‌های پیشین و تنظیمات پیشرفته ({data.legacy_accounts.length+data.organization_accounts.filter((a:any)=>!['owner','executive','research','scientific','customer','finance','admin','it'].includes(a.username)).length})</summary>{data.organization_accounts.filter((a:any)=>!['owner','executive','research','scientific','customer','finance','admin','it'].includes(a.username)).map((a:any)=><OrganizationAccount key={a.username} a={a} minimum={data.password_minimum} busy={busy} action={action} copy={copy} credential={credentials[a.username]} clear={()=>setCredentials(old=>{const next={...old};delete next[a.username];return next})}/>)}<p>حساب‌ها، شناسه‌ها و سوابق پیشین حفظ شده‌اند. این حساب‌ها در فهرست ارجاع جدید سمت‌های سازمانی قرار نمی‌گیرند و مدیریت کل از حساب قدیمی اعطا نمی‌شود.</p>{data.legacy_accounts.map((a:any)=><article key={a.member_id}><b>{a.name}</b> · <code dir="ltr">{a.username}</code> · {a.active?'فعال':'غیرفعال'}<p>شناسه ثابت: <code dir="ltr">{a.member_id}</code></p></article>)}<p>حداقل رمز: {data.password_minimum} نویسه؛ حرف بزرگ، حرف کوچک و عدد. رمزها فقط به مالک اصلی نمایش داده می‌شوند.</p></details></>}</main>
}
function OrganizationAccount({a,minimum,busy,action,copy,credential,clear}:any){
 const [edit,setEdit]=useState(false),[reset,setReset]=useState(false);
 // Keep current database-derived identity/permissions, but show the latest approved role duties and restrictions.
 const d=organizationCatalog.find(r=>r.role_key===a.definition.role_key)||a.definition;
 const responsibility=approvedAccountOverview.find(r=>r.orgRole===d.role_key);
 const accountant=a.username==='accountant';
 const assignedName=a.name||'تعیین نشده';
 return <details className="synapse-account-row" aria-label={d.title_fa}>
  <summary className="synapse-account-bar">
   <span className="synapse-account-arrow" aria-hidden="true">⌄</span>
   <span className="synapse-account-main"><strong>{d.title_fa}</strong><small lang="en" dir="ltr">{d.title_en}</small><small>نام ورود: <code dir="ltr">{a.username}</code> · فرد منصوب: {assignedName}</small></span>
   <span className={a.active?'account-status active':'account-status'}>{!a.exists?'حساب موجود نیست':a.active?'فعال':'غیرفعال'}</span>
  </summary>
  <div className="synapse-account-body">
   {!a.exists&&!accountant&&<p className="hint">این کارت فقط تعریف سمت است؛ ابتدا حساب معتبر مبدأ را منتقل کنید.</p>}
   {responsibility?.status==='needs-review'&&<p className="hint">عنوان مصوب نمایش داده می‌شود؛ انتصاب عملی و اختیارات تخصصی باید جداگانه احراز شوند.</p>}
   <p><b>ورود:</b> {!a.exists?'نیازمند بررسی مدیریت':!a.active?'غیرفعال':a.must_change?'فعال؛ تغییر رمز در اولین ورود':'فعال؛ رمز شخصی تنظیم شده'}</p>
   {a.credential_pending&&<p className="notice">اطلاعات حساب منتقل شده؛ اعتبار رمز قبلی نیازمند بررسی است.</p>}
   <div className="synapse-account-section"><h3>شرح وظایف</h3><ul>{d.duties.map((v:string)=><li key={v}>{v}</li>)}</ul></div>
   <div className="synapse-account-section"><h3>حدود اختیارات</h3><ul>{d.authority.map((v:string)=><li key={v}>{v}</li>)}</ul></div>
   <div className="synapse-account-section"><h3>محدودیت‌ها و تأییدهای لازم</h3><ul>{d.requires_approval.map((v:string)=><li key={v}>{v}</li>)}</ul></div>
   <div className="synapse-account-section"><h3>دسترسی‌های واقعی و جزئیات حساب</h3>
    <p className="hint">فقط مسیرهایی که در حساب فعلی و سرور مجاز هستند نمایش داده می‌شوند. نمایش مسیر، مجوز خواندن همه رکوردها نیست.</p>
    {accountant&&<p>مجوزهای مالی این حساب هنوز فعال نشده‌اند.</p>}
    <nav className="nine-account-access">{a.access.map((link:any)=><a key={link.href} href={link.href}>{link.label}</a>)}</nav>
    <p><b>گزارش به:</b> {d.reports_to?roleTitle(d.reports_to):'بالاترین مسئول پژوهشکده'}</p>
    <p>شناسه ثابت: <code dir="ltr">{a.member_id}</code></p>
    <p>تأیید علمی نهایی: {a.qualified?'صلاحیت مستقل ثبت شده؛ ضوابط پرونده همچنان لازم است':'از عنوان شغلی اعطا نشده است'}</p>
   </div>
   <div className="synapse-account-section synapse-account-actions">
   <div className="nine-account-actions"><button className="secondary" disabled={busy||!a.exists} onClick={()=>{clear();setEdit(!edit);setReset(false)}}>ویرایش مشخصات</button><>{a.username==='owner'?<a className="secondary" href="/account/password">تغییر رمز حساب من</a>:<button className="secondary" disabled={busy||!a.exists} onClick={()=>{clear();setReset(!reset);setEdit(false)}}>تنظیم / بازنشانی رمز</button>}</><button className="secondary" disabled={busy||!a.exists||(!a.can_copy_initial&&!credential)} onClick={()=>copy(a.username)}>کپی امن رمز اولیه</button></div>{edit&&<form className="form-grid" onSubmit={async e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name');if(await action({action:'managed_edit',username:a.username,name}))setEdit(false)}}><label>نام فرد منصوب<input name="name" defaultValue={a.name} required maxLength={100}/></label><p>عنوان سمت و نام ورود ثابت می‌مانند؛ شناسه و سوابق تغییر نمی‌کنند.</p><button className="primary" disabled={busy}>ذخیره مشخصات</button></form>}{reset&&<form className="form-grid" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,password=new FormData(form).get('password');if(!confirm('رمز همین حساب تغییر می‌کند و نشست‌های قبلی آن نامعتبر می‌شوند. تأیید می‌کنید؟'))return;if(await action({action:'managed_reset',username:a.username,password:password||undefined})){form.reset();setReset(false)}}}><label>رمز جدید؛ خالی برای تولید امن<input name="password" type="password" dir="ltr" minLength={minimum} maxLength={128} autoComplete="new-password"/></label><p>رمز جدید به‌صورت رمزگذاری‌شده برای تحویل مالک نگهداری می‌شود؛ تغییر آن در اولین ورود الزامی است.</p><button className="primary" disabled={busy}>ثبت رمز و بستن نشست‌های قبلی</button></form>}{credential&&<div className="credential-box"><p>رمز اولیه جدید <code>{a.username}</code></p><input type="password" readOnly value={credential.password} autoComplete="off" aria-label={'رمز اولیه '+a.username}/><button className="secondary" onClick={()=>copy(a.username)}>کپی امن رمز جدید</button><button className="secondary" onClick={clear}>بستن اطلاعات رمز</button></div>}
   {accountant && !a.exists && <form className="form-grid" onSubmit={e=>{
    e.preventDefault();
    const name=new FormData(e.currentTarget).get('name');
    void action({action:'create',username:a.username,name});
   }}>
    <label>نام فرد منصوب<input name="name" required maxLength={100}/></label>
    <button className="primary" disabled={busy}>ساخت و فعال‌سازی حساب</button>
   </form>}
   {accountant && a.exists && !a.active && <button className="primary" disabled={busy} onClick={()=>{
    void action({action:'active',username:a.username,active:true});
   }}>فعال‌سازی حساب</button>}
   </div>
  </div>
 </details>;
}