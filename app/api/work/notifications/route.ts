import {centralNotices,centralNoticeId,authorizedCentralOrder} from '../../../../lib/shared-central-records';
import {db,identity,json,mutationAllowed} from '../../../../lib/staff-server';
import {workRecord} from '../../../../lib/work-server';
import {readStaffData} from '../../../../lib/staff-data';
import {isWork,isOverdue,participant,workDayKey} from '../../../../lib/work-policy';
import {canSeeOps} from '../../../../lib/ops-policy';
export const dynamic='force-dynamic';
const operationId=(r:any,today:string)=>r.due&&r.due<=today?'ops-due:'+today+':'+r.id+':'+r.revision:'ops:'+r.id+':'+r.revision;
export async function GET(){try{
 const u=await identity();if(!u)return json({error:'ابتدا وارد شوید'},401);
 const records=u.laboratory?[]:(await readStaffData(u)).records,ids=new Set(records.map((r:any)=>r.id));
 const rows=(await db().prepare('SELECT * FROM staff_work_notifications WHERE recipient=? ORDER BY created_at DESC').bind(u.email).all()).results as any[];
 const today=workDayKey(),seen=new Map(rows.map(n=>[n.id,n.read_at]));
 const due=records.filter((r:any)=>isWork(r)&&participant(r,u)&&r.reminder&&r.status!=='done'&&(isOverdue(r,today)||(r.scheduledDate||r.due)===today)).map((r:any)=>({id:'due:'+today+':'+r.id+':'+u.email,record_id:r.id,body:r.title+': یادآوری موعد',created_at:today,read_at:seen.get('due:'+today+':'+r.id+':'+u.email)||''}));
 const work=[...due,...rows.filter(r=>!['due:','mail:','ops:','ops-due:','central:'].some(p=>r.id.startsWith(p))&&ids.has(r.record_id))].map(n=>({...n,title:records.find((r:any)=>r.id===n.record_id)?.title||n.body,source:n.id.startsWith('due:')?'یادآوری موعد':records.find((r:any)=>r.id===n.record_id)?.createdBy||'سامانه',href:'/staff?id='+encodeURIComponent(n.record_id)}));
 // Read-only projection of assigned cases. Does not create tasks, alter cases or introduce a workflow engine.
 const ops=(await db().prepare("SELECT * FROM ops_items WHERE archived_at IS NULL AND assignee=? AND status!='closed' ORDER BY updated_at DESC LIMIT 50").bind(u.email).all()).results as any[];
 const cases=ops.filter(r=>canSeeOps(u,r)).map(r=>{const id=operationId(r,today);return {id,record_id:r.id,title:r.title,body:r.due&&r.due<=today?'اقدام ضروری · موعد '+r.due:'ارجاع / به‌روزرسانی پرونده اختصاص‌یافته',source:r.created_by||'عملیات',created_at:r.updated_at,read_at:seen.get(id)||'',href:'/operations?id='+encodeURIComponent(r.id)}});
 return json({items:[...work,...cases,...await centralNotices(u,today,seen)].sort((a,b)=>b.created_at.localeCompare(a.created_at))});
}catch{return json({error:'دریافت اعلان‌ها ممکن نشد.'},500)}}
export async function POST(req:Request){try{
 if(!mutationAllowed(req))return json({error:'درخواست نامعتبر'},403);const u=await identity();if(!u)return json({error:'ابتدا وارد شوید'},401);const b:any=await req.json();
 if(String(b.id).startsWith('central:')){const o=await authorizedCentralOrder(u,String(b.record_id||''));if(!o||o.current_owner?.id!==u.email||b.id!==centralNoticeId(o,workDayKey()))return json({error:'پرونده مجاز پیدا نشد'},404);const now=new Date().toISOString();await db().prepare('INSERT INTO staff_work_notifications(id,recipient,record_id,body,created_at,read_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET read_at=excluded.read_at').bind(b.id,u.email,o.id,o.title,o.updated_at,now).run();return json({ok:true})}
 if(String(b.id).startsWith('ops:')||String(b.id).startsWith('ops-due:')){const r=await db().prepare('SELECT * FROM ops_items WHERE archived_at IS NULL AND id=? AND assignee=?').bind(String(b.record_id||''),u.email).first<any>();if(!r||!canSeeOps(u,r)||b.id!==operationId(r,workDayKey()))return json({error:'دسترسی ندارید'},403);const now=new Date().toISOString();await db().prepare('INSERT INTO staff_work_notifications(id,recipient,record_id,body,created_at,read_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET read_at=excluded.read_at').bind(b.id,u.email,r.id,r.title,r.updated_at,now).run();return json({ok:true})}
 if(u.laboratory||String(b.id).startsWith('mail:'))return json({error:'دسترسی ندارید'},403);
 const r=await workRecord(String(b.record_id||''),u);if(String(b.id).startsWith('due:')&&b.id==='due:'+workDayKey()+':'+r.id+':'+u.email)await db().prepare('INSERT OR IGNORE INTO staff_work_notifications(id,recipient,record_id,body,created_at,read_at) VALUES(?,?,?,?,?,?)').bind(b.id,u.email,r.id,'یادآوری موعد',new Date().toISOString(),new Date().toISOString()).run();await db().prepare('UPDATE staff_work_notifications SET read_at=? WHERE id=? AND recipient=? AND record_id=?').bind(new Date().toISOString(),b.id,u.email,r.id).run();return json({ok:true});
}catch{return json({error:'ثبت نشد'},400)}}
