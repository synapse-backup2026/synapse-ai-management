import {canFinance} from './finance-policy';
import {canReadOperationWork} from './operation-work-link';
import {organizationalCode} from './organizational-logins';
import {roleTitle} from './org-role-catalog';
import {myOrganizationalResponsibilities} from './organizational-data';
import {db,row} from './staff-server';
import {visible,OWNER} from './staff-policy';
// Dispatch maintenance runs through the integration tick and operations sync.
export async function readStaffData(u:any){
const collaborator="EXISTS(SELECT 1 FROM staff_work_details w,json_each(w.details,'$.collaborators') j WHERE w.record_id=r.id AND j.value=?)";
const clause='r.assignee=? OR r.reviewer=? OR '+collaborator;const args=[u.email,u.email,u.email];
const records:any[]=[];let offset=0;for(;;){const page=await db().prepare('SELECT r.*,w.details FROM staff_records r LEFT JOIN staff_work_details w ON w.record_id=r.id'+(u.manager?'':' WHERE '+clause)+' ORDER BY r.updated_at DESC,r.id LIMIT 500 OFFSET ?').bind(...(u.manager?[]:args),offset).all();records.push(...page.results.map((r:any)=>({...row(r),...JSON.parse(r.details||'{}')})));if(page.results.length<500)break;offset+=500}
const mm=await db().prepare('SELECT m.email,m.name,m.role,m.active,a.username FROM staff_members m LEFT JOIN staff_accounts a ON a.member_id=m.email ORDER BY m.name').all();
const ee=await db().prepare('SELECT e.* FROM staff_events e JOIN staff_records r ON r.id=e.record_id'+(u.manager?'':' WHERE '+clause)+' ORDER BY e.created_at DESC,e.id').bind(...(u.manager?[]:args)).all();
const manualIds=records.filter(r=>r.manualOperationId).map(r=>r.manualOperationId),sourceRows=manualIds.length?(await db().prepare('SELECT * FROM ops_items WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(manualIds)).all()).results as any[]:[],sources=new Map(sourceRows.map(r=>[r.id,r]));const authorized=records.filter((r:any)=>visible(r,u)&&(!r.financeEventId||canFinance(u))&&(!r.manualOperationId||canReadOperationWork(u,r,sources.get(r.manualOperationId))));const ids=new Set(authorized.map((r:any)=>r.id));const files=await db().prepare('SELECT id,record_id,file_name,mime,size,created_by,created_at FROM staff_work_files WHERE record_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify([...ids])).all();
const sampleReferrals=await db().prepare("SELECT COUNT(*) AS total FROM researcher_sample_sheets WHERE deleted_at IS NULL AND assigned_to=?").bind(u.email).first<{total:number}>().catch(()=>null);
return {sampleReferralCount:Number(sampleReferrals?.total||0),organization:await myOrganizationalResponsibilities(u),user:u,records:authorized,members:[{email:OWNER,name:'حمید اکرامی',role:'manager',active:1},...mm.results.filter((m:any)=>m.email!==OWNER).map((m:any)=>{const code=organizationalCode(m.username||'');return {...m,active:code?m.active:0,name:code?roleTitle(code)+' | '+m.name:m.name}}).filter((m:any)=>u.manager||m.active)],events:ee.results.filter((e:any)=>ids.has(e.record_id)),files:files.results.filter((f:any)=>ids.has(f.record_id))}}
