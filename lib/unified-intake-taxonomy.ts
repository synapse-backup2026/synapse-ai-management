/**
 * User-approved unified request taxonomy and initial RESPONSIBILITY routing.
 *
 * IMPORTANT: This module does not grant staff permissions or select an account.
 * Convert role to assignee only through existing workflow_positions / project
 * authority and access checks. Existing stored ticket categories stay readable.
 * Intake, website tickets and direct registration should consume this catalog.
 */
export const intakeResponsibleRoles = [
 {id:'director',label:'رئیس پژوهشکده'},
 {id:'senior_research',label:'مدیر ارشد پژوهشی'},
 {id:'technical_project',label:'مسئول فنی پروژه'},
 {id:'scientific_project',label:'مسئول علمی پروژه'},
 {id:'scientific_reception',label:'پذیرش و پشتیبانی علمی'},
 {id:'finance_manager',label:'مدیر مالی و قراردادها'},
 {id:'accountant',label:'کارشناس حسابداری'},
 {id:'administrative',label:'امور اداری و اجرایی'},
 {id:'it_specialist',label:'کارشناس فناوری اطلاعات'},
] as const;
export type IntakeRoleId = typeof intakeResponsibleRoles[number]['id'];
export const responsibilityByPosition:Readonly<Record<string,IntakeRoleId>>={
 management:'director',executive_director:'senior_research',research_manager:'technical_project',
 scientific_manager:'scientific_project',customer_manager:'scientific_reception',
 finance_manager:'finance_manager',accountant:'accountant',administration_manager:'administrative',
 it_security_manager:'it_specialist',
};
export function responsibilityLabel(code:string){
 const id=responsibilityByPosition[code]||code.replace(/^unified_pending_/,'');
 return intakeResponsibleRoles.find(role=>role.id===id)?.label;
}
export type IntakeGroupId = 'services' | 'consultation';
type Topic = {title:string;role:IntakeRoleId};
export type UnifiedIntakeCategory = {id:string;group:IntakeGroupId;title:string;topics:Topic[]};
const topics=(role:IntakeRoleId, labels:string[]):Topic[]=>labels.map(title=>({title,role}));
export const unifiedIntakeCategories:UnifiedIntakeCategory[] = [
 {id:'service_orders',group:'services',title:'درخواست خدمات و سفارش‌ها',topics:topics('scientific_reception',['درخواست خدمات پژوهشی','ارسال پیش‌فاکتور','اصلاح پیش‌فاکتور','مغایرت پیش‌فاکتور','تحویل نمونه یا مواد پروژه'])},
 {id:'service_projects',group:'services',title:'پروژه‌های در حال اجرا',topics:topics('scientific_reception',['پیگیری پیشرفت پروژه','زمان‌بندی اجرای پروژه','تغییر آزمون سفارش','پروتکل و روش آزمایش','سایر موارد'])},
 {id:'service_results',group:'services',title:'نتایج و خدمات علمی',topics:topics('scientific_project',['زمان تحویل نتایج','نحوه ارسال نتایج','بازبینی نتایج ارسالی','رفع ابهام نتایج','مستندات تکمیلی','سایر موارد'])},
 {id:'service_finance',group:'services',title:'امور مالی و قراردادها',topics:[
  ...topics('accountant',['پرداخت‌ها و واریزی‌ها','اعلام مانده حساب','مغایرت پرداخت‌ها','سایر موارد']),
  ...topics('finance_manager',['تأیید پرداخت‌ها','فاکتور رسمی','مشاوره مالی']),
 ]},
 {id:'service_admin',group:'services',title:'امور داخلی و اداری',topics:topics('administrative',['امور کارکنان','انتقاد و پیشنهاد','درخواست جلسه حضوری','ارتباط با مدیریت','استخدام و همکاری','سایر موارد'])},
 {id:'service_it',group:'services',title:'پشتیبانی فنی و خدمات عمومی',topics:[
  ...topics('it_specialist',['ایراد فنی سایت','مشکلات فرم سامانه','مشکل حساب کاربری']),
  ...topics('administrative',['اطلاع‌رسانی و تبلیغات','ساختمان و تأسیسات','سایر درخواست‌ها']),
 ]},
 {id:'consult_before',group:'consultation',title:'مشاوره پیش از سفارش',topics:topics('technical_project',['بررسی ایده پژوهشی','بررسی پروپوزال','امکان‌سنجی پروژه','انتخاب مدل آزمایشگاهی','انتخاب روش و آزمون','طراحی گروه‌ها و نمونه‌ها','بررسی پروتکل'])},
 {id:'consult_change',group:'consultation',title:'مشاوره اصلاح سفارش',topics:topics('scientific_project',['توضیح خدمات پیش‌فاکتور','اصلاح روش آزمایش','تغییر تعداد نمونه‌ها','افزودن یا حذف آزمون','تغییر محدوده پروژه','مغایرت علمی فاکتور'])},
 {id:'consult_execution',group:'consultation',title:'مشاوره حین اجرا',topics:[
  ...topics('scientific_reception',['مشاوره پذیرش نمونه']),
  ...topics('technical_project',['هماهنگی تخصصی آزمایشگاه','رفع اشکال پروتکل','تغییر روش اجرا','مشکلات کیفیت نمونه','زمان‌بندی علمی پروژه','بررسی داده‌های اولیه']),
 ]},
 {id:'consult_results',group:'consultation',title:'مشاوره نتایج و گزارش',topics:[
  ...topics('scientific_project',['پیگیری آماده‌شدن نتایج']),
  ...topics('technical_project',['بررسی داده‌های خام','بررسی تصاویر آزمایشگاهی','بررسی نمودارها','تفسیر نتایج','اصلاح گزارش علمی','بررسی مستندات و پروتکل','درخواست بازبینی نهایی']),
 ]},
];
export function intakeCategory(id:string){return unifiedIntakeCategories.find(c=>c.id===id);}
export function intakeTopic(id:string,title:string){return intakeCategory(id)?.topics.find(t=>t.title===title);}
export function intakeDefaultResponsibility(id:string,title:string){
 const cat=intakeCategory(id),topic=intakeTopic(id,title);
 return cat&&topic?{group:cat.group,category:cat.id,categoryLabel:cat.title,topic:topic.title,role:topic.role,label:intakeResponsibleRoles.find(r=>r.id===topic.role)!.label}:null;
}
export function seniorResearchMayReview(categoryId:string){
 return ['service_orders','service_projects','service_results','consult_before','consult_change','consult_execution','consult_results'].includes(categoryId);
}
export function intakeGroupLabel(id:IntakeGroupId){return id==='services'?'خدمات و پیگیری':'مشاوره تخصصی';}

export function responsibilityCategories(role:string){
 return unifiedIntakeCategories.filter(c=>role==='director'||(role==='senior_research'?seniorResearchMayReview(c.id):c.topics.some(t=>t.role===role)));
}

export function responsibilityTopics(role:string, category:UnifiedIntakeCategory){
 return category.topics.filter(t=>role==='director'||role==='senior_research'||t.role===role);
}
