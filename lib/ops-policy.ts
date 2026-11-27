import {mayReadRequest,requestRouting} from './dispatch-policy';
import {unifiedRequiredAccess} from './unified-intake-routing';
import {unifiedIntakeCategories,seniorResearchMayReview} from './unified-intake-taxonomy';
import {organizationalCode} from './organizational-logins';
import {visitPurposes} from './communication-policy.ts';
import {hasDataAccess} from './auth-policy.ts';
export const operationCategories=[
 {id:'visits',title:'مراجعات حضوری',number:'07',scope:'operations',items:visitPurposes},
 {id:'customers',title:'مشتریان و سفارش‌ها',number:'01',scope:'operations',items:['ثبت سفارش','درخواست اصلاح فاکتور','مشاوره پیش از سفارش','تحویل نمونه']},
 {id:'billing',title:'فاکتورها و پرداخت‌های مشتریان',number:'02',scope:'billing_ops',items:['فاکتورهای ارسال‌شده','پیش‌نویس فاکتور — ارسال‌نشده','واریزی‌های مشتریان','اعلام واریز یا فیش — منتظر تأیید بانک','صورتحساب و مانده پرداخت','مغایرت پرداخت و پیگیری مانده','لغو سفارش و استرداد وجه']},
 {id:'results',title:'نتایج و خدمات علمی',number:'03',scope:'results_ops',items:['نتایج ارسال‌شده','مشاوره و رفع اشکال نتایج','درخواست رفع اشکال و اطلاعات تکمیلی']},
 {id:'projects',title:'پروژه‌ها و آزمایشگاه‌ها',number:'04',scope:'operations',items:['اجرای پروژه و پیگیری آزمایشگاه‌ها']},
 {id:'internal',title:'امور داخلی و اداری',number:'05',scope:'manager',items:['استخدام و همکاری علمی','امور داخلی و مدیریت','تنخواه و هزینه‌های جاری','هزینه‌های خدمات و خرید شرکت']},
 {id:'system',title:'سامانه و سایر موارد',number:'06',scope:'operations',items:['مشکلات سایت و فرم سفارش','اطلاع‌رسانی و تبلیغات','نیازمند بررسی','گزارش روزانه ایمیل‌ها','امنیت حساب و دسترسی سامانه']},
];
export const privateSubtypes=['امنیت حساب و دسترسی سامانه','گزارش روزانه ایمیل‌ها','نیازمند بررسی'];
export const opsStatuses:Record<string,string>={open:'جدید',doing:'در حال پیگیری',waiting:'منتظر پاسخ',review:'نیازمند بررسی',closed:'بسته‌شده'};
export function categoryFor(subtype:string){return operationCategories.find(c=>c.items.includes(subtype))}
export const administrativeSubtypes=['استخدام و همکاری علمی','امور داخلی و مدیریت'];
export const technicalSubtypes=['مشکلات سایت و فرم سفارش','امنیت حساب و دسترسی سامانه'];
export function canUseOps(user:any){return !!user&&!user.laboratory&&(user.manager||['operations','calls','billing_ops','results_ops','administration_ops','security_ops'].some(s=>hasDataAccess(user,s)))}
function departmentAccess(user:any,item:any){const scope=item.access_scope||item.accessScope;return scope==='administration'&&item.category==='internal'&&administrativeSubtypes.includes(item.subtype)&&hasDataAccess(user,'administration_ops')||scope==='security'&&item.category==='system'&&technicalSubtypes.includes(item.subtype)&&hasDataAccess(user,'security_ops')}
export function canUseOpsCategory(user:any,item:any){if(!canUseOps(user))return false;if(user.manager)return true;
 const unified=requestRouting(item)?.unifiedIntake;
 if(unified){
  const required=unifiedRequiredAccess(String(unified.category||''));
  const senior=organizationalCode(user.username||user.organizationalUsername||'')==='research_manager'&&hasDataAccess(user,'research_supervision')&&seniorResearchMayReview(unified.category);
  return senior||hasDataAccess(user,required)&&(!(item.channel==='phone'||item.source_type==='incoming')||hasDataAccess(user,'calls'));
 }
 if(departmentAccess(user,item))return true;if(item.manager_only||item.managerOnly||item.category==='internal'||privateSubtypes.includes(item.subtype))return false;const c=operationCategories.find(c=>c.id===item.category);const technical=item.category==='system'&&technicalSubtypes.includes(item.subtype)&&hasDataAccess(user,'security_ops');return !!c&&(technical||hasDataAccess(user,c.scope))&&(!((item.channel==='phone')||item.source_type==='incoming'||item.sourceType==='incoming')||hasDataAccess(user,'calls'))}
export function canSeeOps(user:any,item:any){if(item.archived_at)return false;const routing=requestRouting(item);if(routing?.ownerRole)return mayReadRequest(user,item)&&(!routing.unifiedIntake||canUseOpsCategory(user,item));const shared=hasDataAccess(user,'customer_ops')&&['customers','visits'].includes(item.category);return canUseOpsCategory(user,item)&&(user.manager||!!user.email&&(shared||!item.assignee&&hasDataAccess(user,'customer_ops')||item.assignee===user.email||item.created_by===user.email||item.createdBy===user.email))}
export function operationsScope(user:any,routingReady=false):{sql:string;args:any[]}{const scope=operationsVisibleScope(user,routingReady);return {...scope,sql:'archived_at IS NULL AND ('+scope.sql+')'}}
function operationsVisibleScope(user:any,routingReady:boolean):{sql:string;args:any[]}{if(routingReady){const old=operationsVisibleScope(user,false),role=organizationalCode(user?.username||user?.organizationalUsername||'');const senior=role==='research_manager'&&hasDataAccess(user,'research_supervision');
 const categories=unifiedIntakeCategories.filter(c=>hasDataAccess(user,unifiedRequiredAccess(c.id))||senior&&seniorResearchMayReview(c.id)).map(c=>c.id);
 const eligible=categories.length?"json_extract(routing,'$.unifiedIntake.category') IN ("+categories.map(()=>'?').join(',')+")":'0=1';
 const owner=user?.manager&&user.email==='ekramiihamid@gmail.com';
 const phoneAllowed=hasDataAccess(user,'calls')?"1=1":"source_type!='incoming' AND COALESCE(channel,'')!='phone'";
 const categoryAccess=senior?"("+phoneAllowed+" OR json_extract(routing,'$.unifiedIntake.category') IN ('service_orders','service_projects','service_results','consult_before','consult_change','consult_execution','consult_results'))":phoneAllowed;
 const scopeCheck=owner?'1=1':"(json_extract(routing,'$.unifiedIntake.category') IS NULL OR ("+eligible+" AND "+categoryAccess+"))";
 return {sql:`(((${old.sql}) AND json_extract(routing,'$.ownerRole') IS NULL) OR (json_extract(routing,'$.ownerRole') IS NOT NULL AND (created_by=? OR ?=1 OR EXISTS(SELECT 1 FROM json_each(routing,'$.roles') WHERE value=?) OR (json_extract(routing,'$.unifiedIntake.category') IS NOT NULL AND assignee=?) OR (json_extract(routing,'$.unifiedIntake.category') IS NULL AND COALESCE(CAST(json_extract(routing,'$.sensitive') AS TEXT),'false') IN ('0','false') AND json_extract(routing,'$.ownerRole')=?) OR (?=1 AND json_extract(routing,'$.unifiedIntake.category') IN ('service_orders','service_projects','service_results','consult_before','consult_change','consult_execution','consult_results'))) AND ${scopeCheck}))`,
 args:[...old.args,user?.email||'',user?.manager&&user.email==='ekramiihamid@gmail.com'?1:0,role||'',user?.email||'',role||'',senior?1:0,...(owner?[]:categories)]}}if(!canUseOps(user))return {sql:'0=1',args:[]};if(user.manager)return {sql:'1=1',args:[]};const categories=operationCategories.filter(c=>c.id!=='internal'&&hasDataAccess(user,c.scope)).map(c=>c.id);let base=`manager_only=0 AND category IN (${categories.map(()=>'?').join(',')||"''"}) AND subtype NOT IN (${privateSubtypes.map(()=>'?').join(',')})`,args:any[]=[...categories,...privateSubtypes];
 if(hasDataAccess(user,'security_ops')){base+=" OR (category='system' AND subtype=? AND manager_only=0) OR (access_scope='security' AND category='system' AND subtype IN (?,?))";args.push(technicalSubtypes[0],...technicalSubtypes)}
 if(hasDataAccess(user,'administration_ops')){base+=" OR (access_scope='administration' AND category='internal' AND subtype IN (?,?))";args.push(...administrativeSubtypes)}
 let participant='assignee=? OR created_by=?';args.push(user.email,user.email);if(hasDataAccess(user,'customer_ops'))participant+=" OR category IN ('customers','visits') OR trim(assignee)=''";
 return {sql:'('+base+') AND ('+participant+')'+(!hasDataAccess(user,'calls')?" AND source_type!='incoming' AND COALESCE(channel,'')!='phone'":''),args}}
export function requestedAccessScope(u:any,item:any,requested:any){if(sensitive(String(item.title||'')+' '+String(item.sourceBody||item.source_body||'')))return '';if((requested==='administration'||!u.manager&&hasDataAccess(u,'administration_ops'))&&item.category==='internal'&&administrativeSubtypes.includes(item.subtype))return 'administration';if((requested==='security'||!u.manager&&hasDataAccess(u,'security_ops'))&&item.category==='system'&&technicalSubtypes.includes(item.subtype))return 'security';return ''}

export function sensitive(title:string){return /bank\s*statement|statement\s*of\s*account|صورت.?حساب\s*بانک|گردش\s*حساب\s*بانک|one.time\s*(password|code)|verification\s*code|رمز\s*یک.?بار|کد\s*ورود/i.test(title)}
export function validateOpsInput(item:any){const c=categoryFor(item.subtype);return !!c&&c.id===item.category&&typeof item.title==='string'&&item.title.trim().length>0&&item.title.length<=240&&typeof item.sourceBody==='string'&&item.sourceBody.length<=16000&&['gmail','incoming','manual'].includes(item.sourceType)&&(!item.sourceUrl||/^https:\/\//.test(item.sourceUrl))}
