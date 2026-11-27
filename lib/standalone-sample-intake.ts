import {archiveIntake} from './owner-intake-archive';
import {canDeleteData} from './deletion-policy';
import {db} from './staff-server';
import {hasDataAccess} from './auth-policy';
import {canCoordinate} from './lab-execution-policy';
import {digest} from './staff-auth';
import {check,stamp} from './integration-store';
import {intakeCategories,intakeUnits,intakeSuppliers,intakePreparations} from './sample-intake-catalog';

/** Independent administrative sample ledger. This is NOT a scientific order or approved project. */
const intakeAccess=(u:any)=>!!u&&(u.manager||!u.laboratory&&(hasDataAccess(u,'sample_intake')||canCoordinate(u)||hasDataAccess(u,'research_supervision')));
const assignAccess=(u:any)=>!!u&&!u.laboratory&&(u.manager||canCoordinate(u)||hasDataAccess(u,'research_supervision'));
const str=(v:any,max=250)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const optional=(v:any,max=250)=>typeof v==='string'&&v.length<=max;
const whole=(v:any,min=0,max=100000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function allow(u:any){check(u&&(intakeAccess(u)||u.laboratory),'دسترسی پذیرش نمونه ندارید.',403)}
function sanitizeRecord(row:any,u:any){const d=JSON.parse(row.details).intake_v1;const own=u.laboratory?d.samples.filter((s:any)=>s.lab_id===u.laboratoryId):d.samples;
 return {id:row.id,revision:row.revision,status:row.status,created_at:row.created_at||'',project_title:d.project_title,researcher_name:d.researcher_name,
  researcher_phone:u.laboratory?'':d.researcher_phone,researcher_email:u.laboratory?'':d.researcher_email,organization:d.organization,notes:u.laboratory?'':d.notes,samples:own,
  history:u.laboratory?d.history.filter((e:any)=>!e.sample_id||own.some((s:any)=>s.id===e.sample_id)):d.history,
  created_by:row.created_by};
}
export async function readStandaloneSampleIntake(u:any,p:URLSearchParams){allow(u);
 const canReadAll=!u.laboratory&&(u.manager||canCoordinate(u)||hasDataAccess(u,'research_supervision'));
 const rows= u.laboratory
 ? (await db().prepare("SELECT r.id,r.revision,r.status,r.created_by,COALESCE(json_extract(w.details,'$.intake_v1.history[0].at'),r.updated_at) AS created_at,w.details FROM staff_records r JOIN staff_work_details w ON w.record_id=r.id WHERE r.kind='sample_intake' AND r.status!='archived' AND EXISTS(SELECT 1 FROM json_each(w.details,'$.intake_v1.samples') s WHERE json_extract(s.value,'$.lab_id')=?) ORDER BY r.updated_at DESC LIMIT 200").bind(u.laboratoryId).all()).results
 : canReadAll?(await db().prepare("SELECT r.id,r.revision,r.status,r.created_by,COALESCE(json_extract(w.details,'$.intake_v1.history[0].at'),r.updated_at) AS created_at,w.details FROM staff_records r JOIN staff_work_details w ON w.record_id=r.id WHERE r.kind='sample_intake' AND r.status!='archived' ORDER BY r.updated_at DESC LIMIT 200").all()).results
 : (await db().prepare("SELECT r.id,r.revision,r.status,r.created_by,COALESCE(json_extract(w.details,'$.intake_v1.history[0].at'),r.updated_at) AS created_at,w.details FROM staff_records r JOIN staff_work_details w ON w.record_id=r.id WHERE r.kind='sample_intake' AND r.status!='archived' AND (r.created_by=? OR r.assignee=?) ORDER BY r.updated_at DESC LIMIT 200").bind(u.email,u.email).all()).results;
 const all=rows.map((row:any)=>sanitizeRecord(row,u));
 const q=String(p.get('q')||'').trim().toLocaleLowerCase().slice(0,150);
 const records=q?all.filter((x:any)=>[x.researcher_name,x.project_title,x.organization,x.id,...x.samples.map((s:any)=>s.name)].join(' ').toLocaleLowerCase().includes(q)):all;
 const laboratories=!u.laboratory?(await db().prepare("SELECT id,name,type,status FROM laboratories WHERE status='active' ORDER BY name LIMIT 200").all()).results:[];
 return {records,selected:records.find((x:any)=>x.id===p.get('id'))||null,laboratories,can_delete:canDeleteData(u),can_create:intakeAccess(u),can_assign:assignAccess(u),laboratory:!!u.laboratory};
}
async function getRecord(u:any,id:string){check(/^sample-intake:[a-f0-9]{64}$/.test(id),'شناسه معتبر نیست.',400);
 const row=await db().prepare("SELECT r.*,w.details FROM staff_records r JOIN staff_work_details w ON w.record_id=r.id WHERE r.id=? AND r.kind='sample_intake' AND r.status!='archived'").bind(id).first<any>();
 check(row,'برگه نمونه پیدا نشد.',404);
 const d=JSON.parse(row.details).intake_v1;check(d&&Array.isArray(d.samples),'برگه نمونه معتبر نیست.',409);
 check(u.manager||canCoordinate(u)||hasDataAccess(u,'research_supervision')||!u.laboratory&&(row.created_by===u.email||row.assignee===u.email)||u.laboratory&&d.samples.some((s:any)=>s.lab_id===u.laboratoryId),'مجوز مشاهده این برگه وجود ندارد.',403);
 return {row,d};}
export async function writeStandaloneSampleIntake(u:any,b:any){allow(u);if(b.action==='delete')return archiveIntake(u,'staff',b.id,b.revision,b.reason,b.confirmed);check(str(b.key,160),'شناسه درخواست لازم است.',400);
 const now=stamp();
 if(b.action==='create'){
  check(intakeAccess(u)&&!u.laboratory,'ثبت اولیه با پذیرش مجاز است.',403);
  check(str(b.researcher_name,180)&&str(b.project_title,180)&&optional(b.researcher_phone||'',80)&&optional(b.researcher_email||'',200)&&optional(b.organization||'',240)&&optional(b.notes||'',4000),'مشخصات محقق یا پروژه معتبر نیست.');
  check(!b.researcher_email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.researcher_email),'ایمیل معتبر نیست.');
  const id='sample-intake:'+await digest(u.email+':'+b.key);
  const d:any={intake_v1:{project_title:b.project_title.trim(),researcher_name:b.researcher_name.trim(),researcher_phone:String(b.researcher_phone||'').trim(),researcher_email:String(b.researcher_email||'').trim(),organization:String(b.organization||'').trim(),notes:String(b.notes||''),samples:[],history:[{action:'created',at:now,actor:u.email}]}};
  const exists=await db().prepare("SELECT w.details FROM staff_records r JOIN staff_work_details w ON w.record_id=r.id WHERE r.id=? AND r.kind='sample_intake'").bind(id).first<any>();
  if(exists){const old=JSON.parse(exists.details).intake_v1;check(old.project_title===d.intake_v1.project_title&&old.researcher_name===d.intake_v1.researcher_name,'کلید ثبت قبلاً استفاده شده است.',409);return {ok:true,id,replayed:true};}
  const result=await db().batch([
   db().prepare("INSERT OR IGNORE INTO staff_records(id,kind,title,body,assignee,reviewer,priority,status,ref,source_url,created_by,updated_at) VALUES(?,'sample_intake',?,?,?,?,'normal','todo','','',?,?)").bind(id,d.intake_v1.project_title,d.intake_v1.notes,u.email,u.email,u.email,now),
   db().prepare("INSERT OR IGNORE INTO staff_work_details(record_id,details) VALUES(?,?)").bind(id,JSON.stringify(d)),
   db().prepare("INSERT OR IGNORE INTO staff_events(id,record_id,actor,action,body,created_at) VALUES(?,?,?,'standalone-intake-created',?,?)").bind('sample-event:'+await digest(id+':'+b.key),id,u.email,JSON.stringify({researcher:d.intake_v1.researcher_name}),now)
  ]);
  check(result[0].meta.changes||result[1].meta.changes,'برگه ثبت نشد.',409);return {ok:true,id};
 }
 const {row,d}=await getRecord(u,String(b.id||''));
 const key='sample-event:'+await digest(row.id+':'+b.key);
 const prev=await db().prepare('SELECT id FROM staff_events WHERE id=?').bind(key).first<any>();
 if(prev)return {ok:true,id:row.id,replayed:true};
 check(Number(b.revision)===row.revision,'برگه توسط کاربر دیگری تغییر کرده است؛ بازخوانی کنید.',409);
 const original=d.samples.find((s:any)=>s.id===b.sample_id);
 let event:any={actor:u.email,at:now,action:b.action};
 if(b.action==='add_sample'){
  check(intakeAccess(u)&&!u.laboratory,'ثبت نمونه با مسئول پذیرش است.',403);
  check(str(b.name,180)&&str(b.category,120)&&intakeCategories[b.category]?.includes(b.sample_type)&&intakeUnits.includes(b.unit)&&intakeSuppliers.includes(b.supplier)&&intakePreparations.includes(b.preparation)&&optional(b.treatment||'',1000)&&whole(b.quantity,1)&&optional(b.amount_per_unit||'',50)&&optional(b.transport||'',1000)&&optional(b.storage||'',1000)&&optional(b.notes||'',4000),'مشخصات نمونه معتبر نیست.');
  const requestedLabs=Array.isArray(b.requested_labs)?[...new Set(b.requested_labs.filter((id:any)=>typeof id==='string'&&id.length<160))]:[];
  check(requestedLabs.length<=8,'حداکثر هشت آزمایشگاه پیشنهادی مجاز است.',400);
  if(requestedLabs.length){const active=await db().prepare("SELECT id FROM laboratories WHERE status='active'").all();const allowedLabs=new Set(active.results.map((lab:any)=>lab.id));check(requestedLabs.every((id:any)=>allowedLabs.has(id)),'آزمایشگاه پیشنهادی باید از فهرست فعال انتخاب شود.',400)}
  const id='sample:'+await digest(row.id+':'+b.key);
  d.samples.push({id,name:b.name.trim(),category:b.category,sample_type:b.sample_type,unit:b.unit,quantity:b.quantity,amount_per_unit:b.amount_per_unit||'',supplier:b.supplier,preparation:b.preparation,treatment:b.treatment||'',transport:b.transport||'',storage:b.storage||'',notes:b.notes||'',requested_labs:requestedLabs,received:0,lab_id:'',lab_name:'',sent:0,lab_received:0,status:'registered',history:[]});
  event={...event,sample_id:id,quantity:b.quantity};
 }else if(b.action==='receive'){
  check(intakeAccess(u)&&!u.laboratory,'دریافت فیزیکی با پذیرش است.',403);
  check(original&&original.status==='registered'&&whole(b.quantity,1,original.quantity)&&str(b.delivered_by,180)&&str(b.condition,1000)&&optional(b.tracking||'',160)&&whole(b.packages,1,100000)&&optional(b.discrepancy||'',2000),'مشخصات دریافت واقعی نامعتبر است.',409);
  original.received=b.quantity;original.status='received';original.receipt={at:now,actor:u.email,delivered_by:b.delivered_by,condition:b.condition,tracking:b.tracking||'',packages:b.packages,discrepancy:b.discrepancy||'',quantity:b.quantity};
  event={...event,sample_id:original.id,quantity:b.quantity};
 }else if(b.action==='send'){
  check(assignAccess(u),'ارجاع به آزمایشگاه فقط با مسئول فنی یا مدیر مجاز است.',403);
  check(original&&original.status==='received'&&!original.lab_id&&whole(b.quantity,1,original.received)&&str(b.lab_id,160),'نمونه دریافت‌شده و مقصد لازم است.',409);
  const lab=await db().prepare("SELECT id,name FROM laboratories WHERE id=? AND status='active'").bind(b.lab_id).first<any>();
  check(lab,'آزمایشگاه فعال یافت نشد.',404);
  original.lab_id=lab.id;original.lab_name=lab.name;original.sent=b.quantity;original.status='sent';
  original.dispatch={at:now,actor:u.email,quantity:b.quantity,notes:String(b.notes||'').slice(0,2000)};
  event={...event,sample_id:original.id,lab_id:lab.id,quantity:b.quantity};
 }else if(b.action==='lab_receive'){
  check(u.laboratory&&u.laboratoryStatus==='active'&&original&&original.lab_id===u.laboratoryId&&original.status==='sent','تأیید دریافت فقط توسط حساب آزمایشگاه مقصد مجاز است.',403);
  check(whole(b.quantity,0,original.sent)&&optional(b.notes||'',2000),'تعداد دریافتی معتبر نیست.',400);
  original.lab_received=b.quantity;original.status=b.quantity===original.sent?'lab_received':'lab_issue';
  original.lab_receipt={at:now,actor:u.email,quantity:b.quantity,notes:b.notes||'',discrepancy:b.quantity!==original.sent};
  event={...event,sample_id:original.id,quantity:b.quantity,status:original.status};
 }else check(false,'عملیات پذیرش تعریف نشده است.',400);
 d.history.push(event);if(original)original.history.push(event);
 const result=await db().batch([
  db().prepare("UPDATE staff_records SET revision=revision+1,updated_at=? WHERE id=? AND revision=?").bind(now,row.id,row.revision),
  db().prepare("UPDATE staff_work_details SET details=? WHERE record_id=? AND changes()=1").bind(JSON.stringify({intake_v1:d}),row.id),
  db().prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(key,row.id,u.email,'standalone-'+b.action,JSON.stringify(event),now)
 ]);
 check(result[0].meta.changes,'نسخه برگه تغییر کرده؛ بازخوانی کنید.',409);return {ok:true,id:row.id,revision:row.revision+1};
}
