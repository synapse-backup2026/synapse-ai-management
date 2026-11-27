import {memberResponsibility} from './organizational-logins.ts';
/** Staff-only ticket filter metadata. Never change historic ticket rows. */
import {type IntakeRoleId} from './unified-intake-taxonomy';
import {siteTicketCategories} from './ticket-support-taxonomy';
export const ticketStaffCategories=siteTicketCategories;
export const legacyTicketCategories:Record<string,string>={
 orders:'customers',invoices:'billing',payments:'billing',results:'results',
 projects:'projects',internal:'internal',system:'system'
};
export function legacyTicketGroup(id:string){return legacyTicketCategories[id]||'';}
export function ticketTopicAllowed(id:string,topic:string){
 const entry=ticketStaffCategories.find(c=>c.id===id);
 return !!entry&&entry.topics.some(t=>t===topic);
}
export function memberPositionLabel(member:{email?:string;username?:string;name?:string},_roleCatalog:unknown,_code:(username:string)=>string|undefined){
 return memberResponsibility(member)||'در انتظار تعیین مسئولیت';
}
