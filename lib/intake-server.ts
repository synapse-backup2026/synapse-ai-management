import {responsibilityLabel} from './unified-intake-taxonomy';
import {organizationalCode} from './organizational-logins';
import {organizationalRuntimeProfile} from './org-access';
import {db} from './staff-server';
import {DEFAULT_PERMISSIONS} from './auth-policy';
import {canUseOpsCategory} from './ops-policy';
export async function intakeMembers(){const rr=await db().prepare('SELECT m.email,m.name,a.username,a.permissions FROM staff_members m LEFT JOIN staff_accounts a ON a.member_id=m.email LEFT JOIN laboratory_members lm ON lm.member_id=m.email WHERE m.active=1 AND lm.member_id IS NULL ORDER BY m.name').all();return [{email:'ekramiihamid@gmail.com',name:responsibilityLabel('management'),manager:true,permissions:[]},...rr.results.filter((m:any)=>m.email!=='ekramiihamid@gmail.com'&&m.username&&responsibilityLabel(organizationalCode(m.username)||m.username)).map((m:any)=>organizationalRuntimeProfile({email:m.email,name:responsibilityLabel(organizationalCode(m.username)||m.username),username:m.username,manager:false,permissions:m.permissions?JSON.parse(m.permissions):DEFAULT_PERMISSIONS}))]}
export async function validOpsAssignee(email:string,item:any){if(!email)return true;return (await intakeMembers()).some(m=>m.email===email&&canUseOpsCategory(m,item))}
