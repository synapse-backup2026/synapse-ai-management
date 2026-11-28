import {canDeleteData} from './deletion-policy';
import {planOperationWorkUpdate} from './operation-work-link';
import {IntegrationError} from './integration-store';
import {dispatchTaskChanged} from './dispatch-engine';
import {resolveOrganizationalWork} from './workflow-core';
import {organizationalCode,organizationalUsernames} from './organizational-logins';
import {db,json,mutationAllowed} from './staff-server';
import {OWNER,canReview,validateRecord} from './staff-policy';
import {mayAssignWork} from './work-assignment-policy';
import {isWork,participant,validSchedule,workTransition} from './work-policy';
import {WorkError,workRecord,canExecute,notification} from './work-server';
export async function handleWorkRequest(req:Request,user:any){try{if(!mutationAllowed(req))throw new WorkError('درخواست نامعتبر.',403);const u=user;if(!u||u.laboratory)throw new WorkError('دسترسی ندارید.',403);if((await req.clone().text()).length>100000)throw new WorkError('درخواست بزرگ است.',413);const b=await req.json() as any;if(b.action==='delete'&&!canDeleteData(u))throw new WorkError('حذف فقط برای مالک اصلی سامانه مجاز است.',403);const create=b.action==='create';const r=create?null:await workRecord(String(b.id||''),u);if(r&&!isWork(r))throw new WorkError('این رکورد وظیفه اجرایی نیست.');
 if(b.action==='delete'){
  if(!r||b.confirmed!==true||!Number.isSafeInteger(b.revision)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)throw new WorkError('نسخه، دلیل و تأیید حذف لازم است.');
  const at=new Date().toISOString();
  const [result]=await db().batch([
   db().prepare("UPDATE staff_records SET status='archived',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status!='archived'").bind(at,r.id,b.revision),
   db().prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,'work-archived',?,? WHERE changes()=1").bind(crypto.randomUUID(),r.id,u.email,JSON.stringify({reason:b.reason.trim(),previousStatus:r.status}),at),
  ]);
  if(result.meta.changes!==1)throw new WorkError('وظیفه هم‌زمان تغییر کرده است. فهرست را تازه کنید.',409);
  return json({ok:true});
 }

 const members=(await db().prepare('SELECT m.email,m.role FROM staff_members m JOIN staff_accounts a ON a.member_id=m.email WHERE m.active=1 AND a.username IN (SELECT value FROM json_each(?))').bind(JSON.stringify(organizationalUsernames)).all()).results as any[];const active=(id:string)=>id===OWNER||members.some(m=>m.email===id);const ts=new Date().toISOString(),eventId=crypto.randomUUID(),id=r?.id||crypto.randomUUID();let details:any=r?JSON.parse(r.details||'{}'):{collaborators:[],progress:0,subtasks:[],approvalRequired:true};let title=r?.title,status=r?.status,result=r?.result||'',body='',action=b.action;
 if(r?.status==='done'&&!details.completedAt)details.completedAt=r.updatedAt;
 const target=new Set<string>();
 if(create||action==='edit'){
  if(!u.manager)throw new WorkError('ایجاد و ارجاع با مدیریت است.',403);if(r?.status==='done')throw new WorkError('ابتدا کار را بازگشایی کنید.');
  if(create||b.assignee!==r?.assignee||b.assigneePosition){
   const account=await db().prepare('SELECT username FROM staff_accounts WHERE member_id=?').bind(String(b.assignee||'')).first<any>();
   const code=b.assigneePosition||organizationalCode(account?.username||'');if(!code)throw new WorkError('مسئول باید یکی از نه سمت مصوب باشد.',403);
   const resolved=await resolveOrganizationalWork(code);if(b.assignee&&b.assignee!==resolved.member_id)throw new WorkError('فرد با مسئول فعال سمت تطابق ندارد.',409);
   b.assignee=resolved.member_id;details.assigneePosition=resolved.position;details.assignmentRevision=resolved.assignment_revision;
  }
  if(!['task','plan','decision'].includes(b.kind)||!validateRecord(b)||!validSchedule(b))throw new WorkError('اطلاعات، تاریخ یا زمان معتبر نیست.');
  if(!active(b.assignee)||!mayAssignWork(u,b.assignee,r?.assignee))throw new WorkError('مسئول مجاز انتخاب کنید.',403);
  if(!active(b.reviewer)||(b.reviewer!==OWNER&&!members.some(m=>m.email===b.reviewer&&m.role==='reviewer'))||b.reviewer===b.assignee&&b.reviewer!==OWNER)throw new WorkError('تأییدکننده مستقل و مجاز انتخاب کنید.');
  const collaborators=[...new Set<string>(Array.isArray(b.collaborators)?b.collaborators:[])].filter(x=>x!==b.assignee);if(collaborators.length>30||collaborators.some(x=>!active(x)))throw new WorkError('همکار فعال انتخاب کنید.');
  const linkType=String(b.linkType||'');if(!['','project','order','customer','invoice'].includes(linkType))throw new WorkError('نوع ارتباط نامعتبر.');
  details={...details,collaborators,scheduledDate:b.scheduledDate||'',startTime:b.startTime||'',endTime:b.endTime||'',unit:String(b.unit||'').slice(0,100),project:String(b.project||'').slice(0,120),linkType,linkId:String(b.linkId||'').slice(0,120),reminder:!!b.reminder,approvalRequired:b.approvalRequired!==false};title=b.title.trim();status=r?.status||'todo';body=create?'ایجاد و ارجاع وظیفه':JSON.stringify({note:'ویرایش مشخصات و زمان‌بندی',before:{title:r.title,body:r.body,assignee:r.assignee,reviewer:r.reviewer,due:r.due,priority:r.priority,details:JSON.parse(r.details||'{}')},after:{title,body:b.body,assignee:b.assignee,reviewer:b.reviewer,due:b.due,priority:b.priority,details}});target.add(b.assignee);collaborators.forEach(x=>target.add(x));
 }else if(action==='update'){
  if(!canExecute(r,u)&&!canReview(r,u))throw new WorkError('دسترسی ندارید.',403);
  if(!canExecute(r,u)&&(b.result!==undefined&&b.result!==r.result||b.progress!==undefined||b.subtasks!==undefined||b.evidenceUrl!==undefined&&b.evidenceUrl!==r.evidenceUrl))throw new WorkError('گزارش مجری را تغییر ندهید.',403);
  status=String(b.status||r.status);result=String(b.result??r.result).slice(0,12000);
  const err=workTransition(r,u,status,{...b,result});if(err)throw new WorkError(err);
  if(r.kind==='scientific'){const linked=await db().prepare('SELECT id FROM science_cases WHERE source_task_id=?').bind(r.id).first();if(linked&&status==='done')throw new WorkError('تأیید این کار از پرونده علمی مرتبط انجام می‌شود.');}
  if(b.evidenceUrl&&!/^https:\/\//.test(b.evidenceUrl))throw new WorkError('لینک مدرک HTTPS باشد.');
  if(b.progress!==undefined){if(!Number.isInteger(b.progress)||b.progress<0||b.progress>100)throw new WorkError('پیشرفت بین صفر و صد باشد.');details.progress=b.progress}
  if(b.subtasks!==undefined){if(!Array.isArray(b.subtasks)||b.subtasks.length>100||b.subtasks.some((x:any)=>typeof x.title!=='string'||!x.title.trim()||x.title.length>300||typeof x.done!=='boolean'))throw new WorkError('چک‌لیست نامعتبر.');details.subtasks=b.subtasks.map((x:any)=>({title:x.title,done:x.done}))}
  if(status==='blocked'){if(!active(b.nextActor||r.nextActor))throw new WorkError('مسئول اقدام بعدی معتبر نیست.');details.blockReason=String(b.blockReason||r.blockReason).slice(0,2000);details.nextActor=b.nextActor||r.nextActor;target.add(details.nextActor)}
  if(status==='done'){details.progress=100;details.completedAt=ts}if(status==='review'&&r.status!=='review')details.submittedBy=u.email;
  body=JSON.stringify({from:r.status,to:status,result,reason:String(b.reason||'').slice(0,2000)});action=status==='done'?'approve':status==='changes'?'return':status==='review'?'submit':'update';
  if(status==='review')target.add(r.reviewer);if(['done','changes'].includes(status))target.add(r.assignee);
 }else if(action==='comment'||action==='information'||action==='collaborate'){
  if(action==='information'&&(r.status!=='review'||!canReview(r,u)))throw new WorkError('درخواست اطلاعات با تأییدکننده است.',403);
  body=String(b.body||'').trim();if(!body||body.length>12000)throw new WorkError('متن لازم است.');
  if(action==='collaborate'){if(!canExecute(r,u)||!active(b.recipient))throw new WorkError('همکار مجاز انتخاب کنید.',403);target.add(b.recipient);body='درخواست همکاری: '+body;details.collaborationRequests=[...(details.collaborationRequests||[]).filter((x:any)=>x.recipient!==b.recipient),{recipient:b.recipient,by:u.email,body,date:ts}].slice(-50);details.collaborators=[...new Set([...(details.collaborators||[]),b.recipient])].filter(x=>x!==r.assignee)}
  const mentions=Array.isArray(b.mentions)?b.mentions:[];for(const m of mentions){if(!active(m)||!([r.assignee,r.reviewer,OWNER,...(details.collaborators||[])].includes(m)))throw new WorkError('منشن باید برای فرد مجاز همین کار باشد.');target.add(m)}
  target.add(r.assignee);if(action==='information')target.add(r.assignee);
 }else throw new WorkError('عملیات نامعتبر.');
 const event=(conditional:boolean)=>db().prepare('INSERT INTO staff_events(id,record_id,actor,action,body,created_at) '+(conditional?'SELECT ?,?,?,?,?,? WHERE changes()=1':'VALUES(?,?,?,?,?,?)')).bind(eventId,id,u.email,action,body,ts);
 const linked=await planOperationWorkUpdate(u,r,b,status,result,eventId,ts);const statements:any[]=[];
 if(create){statements.push(db().prepare('INSERT INTO staff_records(id,kind,title,body,assignee,reviewer,due,priority,status,ref,source_url,amount,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.kind,title,b.body,b.assignee,b.reviewer,b.due||'',b.priority,status,b.ref||'',b.sourceUrl||'',b.amount||'',u.email,ts),event(false))}
 else {const edit=action==='edit';statements.push(db().prepare('UPDATE staff_records SET kind=?,title=?,body=?,assignee=?,reviewer=?,due=?,priority=?,ref=?,source_url=?,status=?,result=?,evidence_url=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND '+linked.guard).bind(edit?b.kind:r.kind,edit?title:r.title,edit?b.body:r.body,edit?b.assignee:r.assignee,edit?b.reviewer:r.reviewer,edit?b.due||'':r.due,edit?b.priority:r.priority,edit?b.ref||'':r.ref,edit?b.sourceUrl||'':r.sourceUrl,status,result,b.evidenceUrl??r.evidenceUrl,ts,id,Number(b.revision),...linked.args),event(true))}
 statements.push(db().prepare('INSERT INTO staff_work_details(record_id,details) SELECT ?,? WHERE EXISTS(SELECT 1 FROM staff_events WHERE id=?) ON CONFLICT(record_id) DO UPDATE SET details=excluded.details').bind(id,JSON.stringify(details),eventId));
 for(const recipient of target){if(recipient===u.email)continue;statements.push(await notification(eventId+':'+recipient,id,recipient,`${title}: ${action==='collaborate'?'درخواست همکاری':action==='comment'?'پیام یا منشن جدید':action==='return'?'نیازمند اصلاح':action==='submit'?'منتظر بررسی':action==='information'?'درخواست اطلاعات':action==='edit'?'ویرایش مشخصات و زمان‌بندی':body.startsWith('{')?'تغییر وضعیت':body}`,eventId,ts))}
 statements.push(...linked.statements);const res=await db().batch(statements);if(!res[0].meta.changes)throw new WorkError('این کار هم‌زمان تغییر کرده؛ اطلاعات جدید را دریافت و دوباره اقدام کنید.',409);if(['update','approve','submit','return'].includes(action))await dispatchTaskChanged(id,u);return json({ok:true,id});
 }catch(e:any){if(!(e instanceof WorkError)&&!(e instanceof IntegrationError))console.error(e);return json({error:e instanceof WorkError||e instanceof IntegrationError?e.message:'ذخیره نشد؛ دوباره تلاش کنید.'},e instanceof WorkError||e instanceof IntegrationError?e.status:500)}}
