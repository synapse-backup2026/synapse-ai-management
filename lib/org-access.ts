import {ACCOUNTANT_USERNAME} from './accountant-owner-policy';
import {db} from './staff-server';
import {orgRoleCatalog,orgProfilePermissions} from './org-role-catalog';
import {organizationalCode} from './organizational-logins';
export async function organizationReady(){return Number((await db().prepare("SELECT COUNT(*) n FROM pragma_table_info('staff_accounts') WHERE name IN ('org_roles','org_proposed_roles','org_mode','scientific_qualified','org_revision')").first<any>())?.n)===5&&!!(await db().prepare("SELECT name FROM pragma_table_info('workflow_positions') WHERE name='role_definition'").first())}
export async function accountOrganization(memberId:string){if(!await organizationReady())return {orgRoles:[],orgMode:'legacy',scientificQualified:false};const a=await db().prepare('SELECT username,org_roles,org_proposed_roles,org_mode,scientific_qualified FROM staff_accounts WHERE member_id=?').bind(memberId).first<any>();return a?{organizationalUsername:a.username,orgRoles:JSON.parse(a.org_roles),orgProposedRoles:JSON.parse(a.org_proposed_roles),orgMode:a.org_mode,scientificQualified:!!a.scientific_qualified}:{orgRoles:[],orgMode:'legacy',scientificQualified:false}}
export async function passwordMinimum(){const r=await db().prepare("SELECT value FROM staff_auth_settings WHERE id='password_min_length'").first<any>();const n=Number(r?.value??8);return Number.isSafeInteger(n)&&n>=8&&n<=128?n:8}

export const ACCOUNT_PERMISSION_LIMIT='account-permission-limit';

export function organizationalRuntimeProfile(user:any){
 const username=user.organizationalUsername||user.username,code=organizationalCode(username||'');
 if(user.email==='ekramiihamid@gmail.com'&&(!user.local||username==='owner'))return {...user,manager:true,orgRoles:['management']};
 if(username===ACCOUNTANT_USERNAME)return {...user,manager:false,orgRoles:[],permissions:[]};
 if(code&&code!=='management'){const definition=orgRoleCatalog.find(r=>r.role_key===code)!;return {...user,manager:false,orgRoles:[code],permissions:orgProfilePermissions([definition],!!user.scientificQualified).filter(p=>(process.env.SYNAPSE_STANDALONE_BUILD!=='1'&&!(user.permissions||[]).includes(ACCOUNT_PERMISSION_LIMIT))||(user.permissions||[]).includes(p)),orgMode:'managed'};}
 // Historical logins keep their records and ordinary access, never implicit institute administration.
 return {...user,manager:false,permissions:(user.permissions||[]).filter((p:string)=>p!=='institute_admin')};
}
