import {responsibilityLabel} from './unified-intake-taxonomy.ts';
/** Unified research-case metadata; stored on the existing laboratory mother case. */
export const projectKinds = [
 {id:'research',title:'پژوهشی'},
 {id:'laboratory',title:'خدمات آزمایشگاهی'},
 {id:'industrial',title:'صنعتی / قراردادی'},
 {id:'thesis',title:'پایان‌نامه / رساله'},
] as const;
export const projectPriorities = [
 {id:'normal',title:'عادی'},
 {id:'high',title:'بالا'},
 {id:'urgent',title:'فوری'},
] as const;
export const projectResponsibilityTypes = [
 {id:'senior_projects',title:responsibilityLabel('executive_director')!},
 {id:'technical_head',title:responsibilityLabel('research_manager')!},
 {id:'scientific_lead',title:responsibilityLabel('scientific_manager')!},
 {id:'research_specialist',title:'کارشناس پژوهشی'},
 {id:'laboratory_manager',title:'مدیر آزمایشگاه مربوطه'},
] as const;
export const selectableProjectResponsibilities=projectResponsibilityTypes.filter(option=>option.id!=='research_specialist'&&option.id!=='laboratory_manager');
export const projectApproverTypes = [
 {id:'institute_management',title:responsibilityLabel('management')!},
 {id:'senior_projects',title:responsibilityLabel('executive_director')!},
] as const;
export const projectExecutionStatuses = [
 {id:'pending_management',title:'در انتظار تأیید مدیریت'},
 {id:'correction',title:'نیازمند اصلاح پرونده'},
 {id:'pending_executor',title:'در انتظار تأیید مجری'},
 {id:'ready',title:'آماده شروع'},
 {id:'running',title:'در حال اجرا'},
 {id:'paused',title:'متوقف'},
 {id:'finishing',title:'در آستانه اتمام'},
 {id:'completed',title:'اتمام پروژه'},
] as const;
export const projectBlockerReasons = [
 {id:'none',title:'بدون مانع'},
 {id:'unpaid',title:'عدم واریز'},
 {id:'payment_threshold',title:'عدم حدنصاب پرداخت'},
 {id:'researcher_items',title:'در انتظار اقلام محقق'},
 {id:'materials',title:'آماده‌سازی مواد'},
 {id:'executor',title:'تخصیص یا تأیید مجری'},
 {id:'documents',title:'اصلاح مستندات'},
 {id:'other',title:'سایر موارد'},
] as const;
const isOption=(options:readonly {id:string}[],value:unknown)=>typeof value==='string'&&options.some(x=>x.id===value);
function validDay(s:unknown){return s===''||(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s);}
export type ResearchCaseMetadata = {
 project_kind:string; priority:string; responsibility_type:string;
 responsibility_person:string; approver_type:string;
 execution_status:string; blocker_reason:string;
 project_start:string; project_due:string;
};
export function normalizeResearchCaseMetadata(input:any):ResearchCaseMetadata {
 const b=input||{};
 const result:ResearchCaseMetadata={
  project_kind:String(b.project_kind||'research'),
  priority:String(b.priority||'normal'),
  responsibility_type:String(b.responsibility_type||''),
  responsibility_person:String(b.responsibility_person||''),
  approver_type:String(b.approver_type||''),
  execution_status:String(b.execution_status||'pending_management'),
  blocker_reason:String(b.blocker_reason||'none'),
  project_start:String(b.project_start||''),
  project_due:String(b.project_due||''),
 };
 const invalid=(message:string)=>{throw Object.assign(new Error(message),{status:400});};
 if(!isOption(projectKinds,result.project_kind))invalid('نوع پروژه نامعتبر است.');
 if(!isOption(projectPriorities,result.priority))invalid('اولویت پروژه نامعتبر است.');
 if(result.responsibility_type&&!isOption(projectResponsibilityTypes,result.responsibility_type))invalid('نوع مسئولیت نامعتبر است.');
 if(result.responsibility_person.length>200)invalid('شناسه مسئول معتبر نیست.');
 if(!result.responsibility_type&&result.responsibility_person)invalid('ابتدا نوع مسئولیت را انتخاب کنید.');
 if(result.approver_type&&!isOption(projectApproverTypes,result.approver_type))invalid('نوع تأییدکننده نامعتبر است.');
 if(!isOption(projectExecutionStatuses,result.execution_status))invalid('وضعیت اجرا نامعتبر است.');
 if(!isOption(projectBlockerReasons,result.blocker_reason))invalid('دلیل مانع نامعتبر است.');
 if(!validDay(result.project_start)||!validDay(result.project_due))invalid('تاریخ پروژه معتبر نیست.');
 if(result.project_start&&result.project_due&&result.project_start>result.project_due)invalid('موعد پروژه قبل از شروع است.');
 return result;
}
export function projectGroup(status:string,blocker='none'){
 if(['اتمام پروژه','تکمیل‌شده','بسته‌شده','تحویل‌شده'].includes(status))return 'completed';
 if(['در آستانه اتمام','گزارش آماده','در بررسی علمی'].includes(status))return 'finishing';
 if(['در حال اجرا'].includes(status))return 'running';
 if(['متوقف','متوقف یا دارای مانع','تعلیق‌شده'].includes(status)||blocker&&blocker!=='none')return 'paused';
 return 'preparing';
}
