import {db} from './staff-server';
import {canDeleteData} from './deletion-policy';
import {canSeeOps} from './ops-policy';
import {validOpsAssignee} from './intake-server';
import {operationWorkStatements} from './operation-work-link';
import {check,stamp} from './integration-store';
import {OWNER} from './staff-policy';
// Acceptance records the owner's review; it never confirms money, science or completion.
export async function acceptOperation(u:any,b:any){
 check(canDeleteData(u),'پذیرش نهایی فقط با مالک اصلی است.',403);
 const r=await db().prepare('SELECT * FROM ops_items WHERE id=? AND archived_at IS NULL').bind(String(b.id||'')).first<any>();
 check(r&&canSeeOps(u,r),'درخواست مجاز پیدا نشد.',404);
 const eid='ops-owner-accept:'+r.id,accepted=await db().prepare('SELECT id FROM staff_events WHERE id=?').bind(eid).first();
 if(accepted)return {ok:true,replayed:true,id:r.id};
 check(Number.isSafeInteger(b.revision)&&b.revision===r.revision,'درخواست تغییر کرده؛ بازخوانی کنید.',409);
 const active=!!r.assignee&&await validOpsAssignee(r.assignee,r),at=stamp(),m=JSON.parse(r.routing||'{}');
 const routing={...m,ownerAcceptance:{by:u.email,at},acceptanceNeedsAssignment:!active};
 const q:any[]=[db().prepare('UPDATE ops_items SET routing=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(routing),at,r.id,r.revision),db().prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,NULL,'','','','' WHERE changes()!=1").bind(eid+':guard'),db().prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) VALUES(?,?,?,'ops-owner-accepted',?,?)").bind(eid,r.id,u.email,JSON.stringify({assignee:r.assignee,needs_assignment:!active}),at)];
 if(active){
  if(!m.ownerRole)q.push(...operationWorkStatements(r,r.assignee,eid,at,u.email));
  else {const tid='dispatch:'+r.id+':'+m.ownerRole,details={dispatchRequest:r.id,assigneePosition:m.ownerRole,manualAssignment:true,collaborators:[],approvalRequired:false,scheduledDate:r.due||'',progress:r.status==='closed'?100:0};
   q.push(db().prepare("INSERT OR IGNORE INTO staff_records(id,kind,title,body,assignee,reviewer,due,priority,status,ref,source_url,created_by,updated_at) VALUES(?,'task',?,?,?,?,?,?,?,?,?,?,?)").bind(tid,r.title,r.source_body,r.assignee,OWNER,r.due,r.priority,r.status==='closed'?'done':'todo',r.id,'/operations?id='+encodeURIComponent(r.id),u.email,at),db().prepare('INSERT OR IGNORE INTO staff_work_details(record_id,details) VALUES(?,?)').bind(tid,JSON.stringify(details)),db().prepare('INSERT OR IGNORE INTO staff_work_notifications(id,recipient,record_id,body,created_at) VALUES(?,?,?,?,?)').bind(eid+':work',r.assignee,tid,'درخواست با تأیید مالک برای پیگیری در کارتابل شماست.',at));
  }
 }
 await db().batch(q);return {ok:true,id:r.id,needs_assignment:!active};
}
