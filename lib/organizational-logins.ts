import {responsibilityLabel} from './unified-intake-taxonomy.ts';
// Login labels are independent of persistent member and workflow position identifiers.
export const organizationalLogins:Record<string,string>={executive_director:'executive',customer_manager:'customer',scientific_manager:'scientific',finance_manager:'finance',research_manager:'research',administration_manager:'admin',it_security_manager:'it',research_specialist:'specialist'};

export const organizationalUsernames=['owner',...Object.values(organizationalLogins)];
export const organizationalCode=(username:string)=>username==='owner'?'management':Object.keys(organizationalLogins).find(k=>organizationalLogins[k]===username);


export function memberResponsibility(member:{email?:string;id?:string;username?:string;role_code?:string;code?:string}):string|undefined{
 const id=member.email||member.id||'';
 if(id.toLowerCase()==='ekramiihamid@gmail.com')return responsibilityLabel('management');
 const username=member.username??(id.startsWith('staff:')?id.slice(6):'');
 return responsibilityLabel(member.role_code||member.code||organizationalCode(username)||username);
}

type ResponsibilityMember = Parameters<typeof memberResponsibility>[0];

export function responsibilityForAccount(id: string, members: readonly ResponsibilityMember[] = []): string {
 if (!id) return 'بدون مسئول';
 const member = members.find(candidate => (candidate.email || candidate.id) === id);
 return memberResponsibility(member ?? { id }) ?? 'در انتظار تعیین مسئولیت';
}
