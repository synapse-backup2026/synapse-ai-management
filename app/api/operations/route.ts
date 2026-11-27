import {archiveIntake} from '../../../lib/owner-intake-archive';
import {acceptOperation} from '../../../lib/operations-owner-accept';
import {operationWorkStatements,operationCommentStatements} from '../../../lib/operation-work-link';
import {assignOperationsManually} from '../../../lib/operations-manual-assignment';
import {dispatchReady,dispatchWrite,readDispatch,dispatchCreate} from '../../../lib/dispatch-engine';
import {organizationReady} from '../../../lib/org-access';
import {readWorkflow,writeWorkflow} from '../../../lib/workflow-core';
import {workflowActions,workflowViews,WorkflowError} from '../../../lib/workflow-policy';
import {mayAssignWork,SELF_ASSIGNMENT_ERROR} from '../../../lib/work-assignment-policy';
import {canDeleteData,deletionAction} from '../../../lib/deletion-policy';
import {validCommunication} from '../../../lib/communication-policy';
import {readOperationsData} from '../../../lib/operations-data';
import {db,identity,json,mutationAllowed,eventStmt} from '../../../lib/staff-server';
import {hasDataAccess} from '../../../lib/auth-policy';
import {operationPayments} from '../../../lib/finance-data';
import {canSeeOps,canUseOps,canUseOpsCategory,requestedAccessScope,categoryFor,privateSubtypes,sensitive,opsStatuses,validateOpsInput} from '../../../lib/ops-policy';
import {intakeFields,validIntake,validDue} from '../../../lib/intake-policy';
import {validOpsAssignee} from '../../../lib/intake-server';
import {intakeDefaultResponsibility} from '../../../lib/unified-intake-taxonomy';
import {validPersianContactName,normalizeIranPhone,validOptionalEmail} from '../../../lib/unified-intake-routing';
export const dynamic='force-dynamic';
export async function GET(req:Request){const u=await identity();if(!u)return json({error:'ابتدا وارد شوید'},401);if(new URL(req.url).searchParams.get('view')==='dispatch'){try{return json(await readDispatch(u,new URL(req.url).searchParams))}catch(e:any){return json({error:e.message},e.status||500)}}if(workflowViews.includes(new URL(req.url).searchParams.get('view')||'')){try{return json(await readWorkflow(u,new URL(req.url).searchParams))}catch(e){if(e instanceof WorkflowError)return json({error:e.message},e.status);console.error('workflow read failed',e);return json({error:'خواندن پرونده مرکزی ممکن نشد.'},500)}}if(!canUseOps(u))return json({error:'دسترسی ندارید'},403);try{return json(await readOperationsData(u,new URL(req.url).searchParams))}catch(e:any){console.error('operations API read failed',e?.code||e?.message||'unknown');return json({error:'دریافت داده‌های پذیرش با خطای سرور مواجه شد؛ هیچ داده‌ای تغییر نکرده است.'},500)}}
export async function POST(req:Request){
 if(!mutationAllowed(req))return json({error:'درخواست نامعتبر'},403);
 const u=await identity();if(!u)return json({error:'ابتدا وارد شوید'},401);
 if(Number(req.headers.get('content-length')||0)>50000)return json({error:'حجم درخواست زیاد است'},413);
 const rawBody=await req.text();if(rawBody.length>50000)return json({error:'حجم درخواست زیاد است'},413);let b:any;try{b=JSON.parse(rawBody)}catch{return json({error:'JSON معتبر نیست'},400)};if(b.action==='create'&&(b.unifiedCategory||b.unifiedTopic)){
  if(!intakeDefaultResponsibility(String(b.unifiedCategory||''),String(b.unifiedTopic||'')))return json({error:'دسته و موضوع انتخاب‌شده معتبر نیست.'},400);
  if(!validPersianContactName(b.clientName)||!validOptionalEmail(String(b.email||'')))return json({error:'نام فارسی و ایمیل معتبر وارد کنید.'},400);
  if(b.channel==='phone'&&!normalizeIranPhone(String(b.phone||'')))return json({error:'شماره موبایل ایرانی معتبر وارد کنید.'},400);
  if(!String(b.customerRequest||'').trim()||!String(b.staffResponse||'').trim())return json({error:'درخواست و پاسخ پشتیبانی را تکمیل کنید.'},400);
  if(b.assignee&&String(b.assignmentReason||'').trim().length<4)return json({error:'برای تعیین مسئول دستی باید دلیل ثبت شود.'},400);
  b.phone=b.phone?normalizeIranPhone(String(b.phone)):'';b.email=String(b.email||'').trim().toLowerCase();
 }
 if(b.action==='delete'){try{return json(await archiveIntake(u,'operation',b.id,b.revision))}catch(e:any){return json({error:e.status?e.message:'حذف از فهرست انجام نشد.'},e.status||500)}}
 if(b.action==='owner_accept'){try{return json(await acceptOperation(u,b))}catch(e:any){return json({error:e.status?e.message:'پذیرش ثبت نشد.'},e.status||400)}}if(b.action==='manual_assign'){try{return json(await assignOperationsManually(u,b))}catch(e:any){return json({error:e.status?e.message:'ارجاع ذخیره نشد.'},e.status||400)}}if(String(b.action).startsWith('dispatch_')||b.action==='create'&&await dispatchReady()){try{
 const result=await dispatchWrite(u,{...b,action:b.action==='create'?'dispatch_create':b.action});
 if(b.action==='create'&&String(b.sourceKey||'').startsWith('intake:')&&!result.replayed&&result.id){
  await db().prepare("UPDATE ops_items SET call_date=? WHERE id=? AND created_by=? AND COALESCE(call_date,'')=''").bind(String(b.callDate||'').slice(0,80),result.id,u.email).run();
 }
 if(b.action==='create'&&String(b.sourceKey||'').startsWith('intake:')&&String(b.assignee||'').trim()&&result.id){
  if(result.replayed)return json({...result,assignment_warning:'این ارتباط قبلاً ثبت شده است؛ برای تغییر مسئول، پرونده موجود را باز کنید.'});
  const current=await db().prepare('SELECT revision FROM ops_items WHERE id=?').bind(result.id).first<any>();
  if(!current)return json({...result,assignment_warning:'پرونده ثبت شد اما برای تخصیص دستی پیدا نشد؛ در فهرست بررسی کنید.'});
  const transfer=await assignOperationsManually(u,{items:[{id:result.id,revision:Number(current.revision)}],assignee:String(b.assignee),reason:String(b.assignmentReason||'')});
  if(!transfer.ok)return json({...result,assignment_warning:transfer.results?.[0]?.error||'ثبت شد اما ارجاع دستی کامل نشد.'});
 }
 return json(result);
 }catch(e:any){return json({error:e.message},e.status||500)}}if(workflowActions.includes(b.action)){try{return json(await writeWorkflow(u,b))}catch(e){if(e instanceof WorkflowError)return json({error:e.message},e.status);console.error('workflow mutation failed',e);return json({error:'ثبت پرونده مرکزی انجام نشد.'},500)}}if(deletionAction(b.action)&&!canDeleteData(u))return json({error:'حذف فقط برای مالک اصلی سامانه مجاز است.'},403);
 if(b.action==='create'){
  const c=categoryFor(b.subtype),direction=String(b.direction||'inbound'),channel=String(b.channel||(b.sourceType==='incoming'?'phone':'manual')),visitPurpose=String(b.visitPurpose||'');
  if(!validCommunication(direction,channel,visitPurpose))return json({error:'روش ارتباط یا موضوع مراجعه معتبر نیست'},400);
  const sourceType=channel==='phone'?'incoming':'manual',item={...b,category:c?.id,sourceType,sourceBody:String(b.sourceBody||'')};
  const f=intakeFields(b);if(!validIntake(f)||!validDue(b.due||''))return json({error:'نوع درخواست، اطلاعات پذیرش یا موعد معتبر نیست'},400);
  if(!validateOpsInput(item))return json({error:'عنوان، موضوع و شرح معتبر وارد کنید'},400);
  const orgReady=await organizationReady();const candidate:any={...item,access_scope:orgReady?requestedAccessScope(u,item,b.accessScope):'',managerOnly:c?.id==='internal'||privateSubtypes.includes(b.subtype)||sensitive(b.title+' '+item.sourceBody)};
  if(!canUseOpsCategory(u,candidate)||sourceType==='incoming'&&!hasDataAccess(u,'calls'))return json({error:'اجازه ثبت در این بخش ندارید'},403);
  const assignee=String(b.assignee??'');if(!mayAssignWork(u,assignee))return json({error:SELF_ASSIGNMENT_ERROR},403);if(!await validOpsAssignee(assignee,candidate))return json({error:'مسئول باید فعال باشد و دسترسی این پرونده را داشته باشد'},400);
  const id=crypto.randomUUID(),now=new Date().toISOString(),ticketFlag=f.isTicket&&direction!=='visit'&&channel!=='phone'?1:0;
  await db().batch([db().prepare('INSERT INTO ops_items ('+(orgReady?'access_scope,':'')+'id,source_key,category,subtype,title,source_body,client_name,phone,email,reference,call_date,source_type,assignee,due,payment_state,manager_only,created_by,created_at,updated_at,direction,channel,visit_purpose,request_type,client_kind,organization,representative,intake_state,intake_notes,is_ticket,ticket_kind) VALUES ('+(orgReady?'?,':'')+'?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...(orgReady?[candidate.access_scope]:[]),id,'native:'+id,c!.id,b.subtype,b.title.trim(),item.sourceBody,String(b.clientName||'').slice(0,160),String(b.phone||'').slice(0,80),String(b.email||'').slice(0,200),String(b.reference||'').slice(0,160),String(b.callDate||'').slice(0,80),sourceType,assignee,b.due||'',c!.id==='billing'?'pending':'unknown',candidate.managerOnly?1:0,u.email,now,now,direction,channel,visitPurpose,f.requestType,f.clientKind,f.organization,f.representative,f.intakeState,f.intakeNotes,ticketFlag,f.ticketKind),await eventStmt(id,u.email,'ops-create','ثبت '+(direction==='visit'?'مراجعه حضوری':sourceType==='incoming'?'تماس':ticketFlag||channel!=='manual'?'تیکت پیام':'درخواست عملیاتی'))]);
  return json({ok:true,id});
 }
 const raw=await db().prepare('SELECT * FROM ops_items WHERE id=?').bind(String(b.id||'')).first<any>();
 if(!raw||!canSeeOps(u,raw))return json({error:'مورد پیدا نشد یا دسترسی ندارید'},404);
 if(b.action==='comment'&&JSON.parse(raw.routing||'{}').ownerRole){try{return json(await dispatchCreate(u,{requestId:raw.id,title:raw.title,sourceBody:String(b.body||''),partyKind:'employee',direction:'internal',channel:'manual',informational:true}))}catch(e:any){return json({error:e.message},e.status||500)}}
 if(b.action==='comment'){const body=String(b.body||'').trim();if(!body||body.length>12000)return json({error:'متن معتبر بنویسید'},400);const eventId=crypto.randomUUID(),at=new Date().toISOString();await db().batch([db().prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) VALUES(?,?,?,'comment',?,?)").bind(eventId,raw.id,u.email,body,at),...operationCommentStatements(raw,eventId,at,u.email,body)]);return json({ok:true})}
 if(b.action==='update'&&JSON.parse(raw.routing||'{}').ownerRole){try{return json(await dispatchWrite(u,{...b,action:'dispatch_update',state:({open:'routed',doing:'doing',waiting:'waiting_customer',review:'waiting_approval',closed:'closed'} as any)[b.status]}))}catch(e:any){return json({error:e.message},e.status||500)}}
 if(b.action==='update'){
  if(!u.manager&&raw.assignee&&raw.assignee!==u.email)return json({error:'تغییر وضعیت فقط برای مسئول پیگیری یا مدیر مجاز است'},403);
  const f=intakeFields(b,raw);if(!validIntake(f)||!validDue(b.due??raw.due))return json({error:'اطلاعات پذیرش یا موعد معتبر نیست'},400);
  if(!opsStatuses[b.status]||!['normal','high','urgent'].includes(b.priority)||String(b.resolution||'').length>12000)return json({error:'وضعیت یا گزارش معتبر نیست'},400);
  if(b.status==='closed'&&!String(b.resolution||'').trim())return json({error:'برای بستن، نتیجه پیگیری را بنویسید'},400);
  const financial=(await operationPayments([raw.id])).get(raw.id);
  if(b.paymentState==='verified'&&!(financial?.paid_rial>0))return json({error:'وصول فقط از تراکنش تأییدشده دفتر مالی قابل اثبات است.'},409);
  const paymentState=['unknown','pending','reported'].includes(b.paymentState)?b.paymentState:raw.payment_state==='reported'?'reported':raw.category==='billing'?'pending':'unknown';
  const assignee=String(b.assignee??raw.assignee??'');if(!mayAssignWork(u,assignee,raw.assignee))return json({error:SELF_ASSIGNMENT_ERROR},403);
  if(!u.manager&&!assignee)return json({error:'برای ارجاع، مسئول فعال انتخاب کنید'},400);
  if(!await validOpsAssignee(assignee,raw))return json({error:'گیرنده باید فعال باشد و دسترسی این پرونده را داشته باشد'},400);
  const now=new Date().toISOString(),eventId=crypto.randomUUID(),rev=Number(b.revision),due=b.due??raw.due,ticketFlag=f.isTicket&&raw.direction!=='visit'&&raw.channel!=='phone'&&raw.source_type!=='incoming'?1:0;
  const results=await db().batch([
   db().prepare('UPDATE ops_items SET status=?,priority=?,resolution=?,assignee=?,due=?,payment_state=?,request_type=?,client_kind=?,organization=?,representative=?,intake_state=?,intake_notes=?,is_ticket=?,ticket_kind=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(b.status,b.priority,String(b.resolution||''),assignee,due,paymentState,f.requestType,f.clientKind,f.organization,f.representative,f.intakeState,f.intakeNotes,ticketFlag,f.ticketKind,now,raw.id,rev),
   db().prepare('INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(eventId,raw.id,u.email,'ops-update',JSON.stringify({from:raw.status,to:b.status,resolution:b.resolution,paymentState,fromAssignee:raw.assignee,toAssignee:assignee,fromDue:raw.due,toDue:due,intakeBefore:intakeFields({},raw),intakeAfter:f}),now),...operationWorkStatements({...raw,status:b.status,priority:b.priority,resolution:String(b.resolution||''),due},assignee,eventId,now,u.email)
  ]);
  if(!results[0].meta.changes)return json({error:'این مورد هم‌زمان تغییر کرده؛ دوباره بازش کنید'},409);
  return json({ok:true});
 }
 return json({error:'عملیات معتبر نیست'},400);
}
