import {laboratoryDomains} from './laboratory-center-policy.ts';
import {hasDataAccess,hasAccess} from './auth-policy.ts';
export type NavItem={label:string,href:string,enabled:boolean,category?:string};
export type NavGroup={id:string,label:string,items:NavItem[]};
function navigationDefinitions(user:any):NavGroup[]{const can=(scope:string)=>hasAccess(user,scope);const item=(label:string,href:string,enabled=true,category?:string)=>({label,href,enabled,...(category?{category}:{})});if(user.laboratory)return [{id:'management',label:'مدیریت و راهبری پژوهشکده',items:[item('مدیریت و پیگیری درخواست‌ها','/operations?view=dispatch')]},{id:'operations',label:'پذیرش و ارتباطات',items:[item('پذیرش، ارتباط و پشتیبانی','/operations'),item('پذیرش نمونه محققین','/sample-intake',hasDataAccess(user,'sample_intake')),item('برگه‌های ارجاعی نمونه','/sample-intake?mode=referrals'),item('تیکت و پشتیبانی','/operations?view=tickets')]},{id:'laboratory-cases',label:'پرونده‌های آزمایشگاهی',items:[item('فهرست کل پرونده‌ها','/laboratories')]},{id:'laboratories',label:'آزمایشگاه‌ها',items:laboratoryDomains.map(d=>item(d.title,'/laboratories?domain='+d.id))}];return [
{id:'operations',label:'پذیرش و ارتباطات',items:[item('پذیرش، ارتباط و پشتیبانی','/operations',user.manager||['operations','calls','billing_ops','results_ops'].some(can)),item('پذیرش نمونه محققین','/sample-intake',hasDataAccess(user,'sample_intake')),item('برگه‌های ارجاعی نمونه','/sample-intake?mode=referrals'),item('تیکت و پشتیبانی','/operations?view=tickets',user.manager||['operations','billing_ops','results_ops'].some(can))]},
{id:'work',label:'کارتابل و برنامه‌ریزی',items:[item('کارتابل و برنامه‌ریزی','/staff?view=dashboard'),item('امروز من','/staff?view=overview'),item('همه وظایف','/staff?view=all'),item('برد وظایف','/staff?view=board'),item('برنامه‌ریزی','/staff?view=plans'),item('بررسی و تأیید','/staff?view=approvals'),item('مکاتبات داخلی','/work/mail',can('mail'))]},
{id:'research',label:'مشاوره علمی و مدیریت پروژه‌ها',items:[item('ثبت پرونده و مدیریت پروژه','/laboratories',can('lab')||can('lab_operations')||can('sample_intake')||can('research_supervision')),item('مرکز مشاوره علمی','/work/science',can('science')),item('مشتریان','/operations?view=history',user.manager||['operations','calls','billing_ops','results_ops'].some(can))]},
{id:'laboratory-cases',label:'پرونده‌های آزمایشگاهی',items:[item('فهرست کل پرونده‌ها','/laboratories',can('lab')||can('lab_operations')||can('sample_intake')||can('research_supervision')),item('ثبت پرونده جدید','/laboratories?view=new',can('lab_operations')||can('sample_intake')||!!user.manager)]},
{id:'laboratories',label:'آزمایشگاه‌ها',items:laboratoryDomains.map(d=>item(d.title,'/laboratories?domain='+d.id,can('lab')||can('lab_operations')||can('sample_intake')||can('research_supervision')))},
{id:'finance',label:'مالی و قراردادها',items:[item('داشبورد مالی','/finance/dashboard',user.manager||can('finance_ops')),item('پرونده‌های مالی پروژه‌ها','/finance/invoices',user.manager||can('finance_ops'),'documents'),item('برآورد و پیش‌فاکتور','/finance/pricing',user.manager||can('finance_ops')||can('quote_ops'),'documents'),item('دریافت‌ها و تسویه مشتریان','/finance/receipts',user.manager||can('finance_ops'),'payments'),item('پرداخت‌ها و هزینه‌ها','/finance/payables',!user.laboratory,'payments'),item('صورت‌حساب و تطبیق بانک','/finance/bank',user.manager||can('finance_ops'),'payments'),item('تنخواه','/finance/petty-cash',user.manager||can('petty_cash')||can('finance_ops'),'payments'),item('حسابداری و تعرفه‌ها','/finance/ledger',user.manager||can('finance_ops'),'accounting')]},
{id:'management',label:'مدیریت و راهبری پژوهشکده',items:[item('مدیریت و پیگیری درخواست‌ها','/operations?view=dispatch'),item('نمای کلی پژوهشکده','/work/leadership',!!user.manager),item('سیاست‌ها و سوابق مالی','/finance/compare',!!user.manager),item('منابع مکاتبات','/manage/mail',can('resources')),item('منابع پروژه و پیمانکار','/manage/projects',can('resources')),item('مدیریت و توسعه','/work/development',can('development')),item('گفتگوهای من','/manage/chats',!!user.manager),item('حساب‌های کارکنان','/accounts',!!user.manager),item('منابع ورودی و اتصال‌ها','/manage/connections',!!user.manager&&user.email==='ekramiihamid@gmail.com')]},
]}
export function activeNavigation(path:string,query:URLSearchParams,href:string){const u=new URL(href,'https://synapse.local');if(u.pathname==='/finance/compare'&&['/manage/finance','/work/contracts'].includes(path))return true;if(u.pathname==='/finance/compare'&&path==='/staff'&&query.get('view')==='resellers')return true;if(path==='/operations'&&query.get('category')==='billing'&&u.pathname==='/operations'&&!u.search)return false;if(path!==u.pathname)return false;if(u.pathname==='/operations'&&!u.search)return query.get('source')!=='incoming'&&!query.get('direction')&&!query.get('view');const expected=[...u.searchParams];if(!expected.length)return (path!=='/laboratories'||!query.get('domain'))&&!query.get('view')&&!query.get('category')&&!query.get('source');return expected.every(([key,value])=>(query.get(key)||(key==='view'?'overview':''))===value)}

export const financeNavigationCategories:Record<string,string>={documents:'اسناد و قراردادها',payments:'دریافت و تسویه',accounting:'حسابداری و تعرفه‌ها'};
export function navigationSections(group:NavGroup){return Object.entries(financeNavigationCategories).map(([id,label])=>({id,label,items:group.items.filter(i=>i.category===id)})).filter(s=>s.items.length)}


// One registry for the shell, home previews and legacy entry points. This is
// navigation metadata only; the existing APIs remain the authorization boundary.
export const routeAliases:Record<string,string>={
 '/work/desks':'/operations','/work/finance':'/finance/dashboard',
 '/manage/finance':'/finance/dashboard','/work/contracts':'/finance/compare',
};
const groupDescriptions:Record<string,string>={
 operations:'ثبت درخواست، تماس، پذیرش نمونه و پیگیری مشتری',
 work:'وظایف امروز، برد مشترک، برنامه و بررسی نتیجه',
 research:'ثبت پرونده، مدیریت پروژه، مشاوره علمی و سوابق مشتری',
 laboratories:'خدمات تخصصی، روش‌ها، نمونه‌ها و نتایج آزمایشگاه',
 finance:'پرونده مالی، برآورد، دریافت، پرداخت و حسابداری',
 management:'حساب‌ها، منابع، اتصال‌ها و نظارت پژوهشکده',
};
export function workspaceNavigation(user:any):NavGroup[]{
 const groups=navigationDefinitions(user);
 const cases=groups.find(g=>g.id==='laboratory-cases');
 let research=groups.find(g=>g.id==='research');
 if(!research){research={id:'research',label:'اجرای پژوهشی',items:[]};groups.push(research)}
 // Laboratory-only navigation keeps its established case links; for standard users
 // the consolidated case entry above replaces both older sidebar shortcuts.
 if(cases&&user.laboratory)research.items.push(...cases.items);
 // Keep all existing destinations while presenting the six approved domains.
 const order=['operations','work','research','laboratories','finance','management'];
 const labels:Record<string,string>={work:'کارتابل و برنامه‌ریزی',research:'مشاوره علمی و مدیریت پروژه‌ها',laboratories:'متدها و آزمایش‌ها'};
 return order.flatMap(id=>{const g=groups.find(g=>g.id===id);return g?[{...g,label:labels[id]||g.label}]:[]});
}
export function routeRegistry(user:any){
 return workspaceNavigation(user).flatMap(group=>group.items.map(item=>({
 ...item,group:group.id,groupTitle:group.label,description:groupDescriptions[group.id],
 destination:item.href,access:item.enabled?'available':'restricted',
 })));
}
export function resolveWorkspaceRoute(path:string,query:URLSearchParams,user:any){
 if(path==='/manage/finance'&&query.get('resources')==='1')return {label:'منابع و سوابق مالی',group:'finance',groupTitle:'مالی و قراردادها',href:path+'?resources=1'};
 const registry=routeRegistry(user);
 // Old phone notebook deep links resolve into the existing unified intake menu.
 if(path==='/operations'&&query.get('source')==='incoming')return registry.find(route=>route.href==='/operations');
 const matches=registry.filter(route=>activeNavigation(path,query,route.href));
 // A domain / new-case link must win over its parent list.
 const exact=matches.sort((a,b)=>new URL(b.href,'https://synapse.local').searchParams.size-new URL(a.href,'https://synapse.local').searchParams.size)[0];
 if(exact)return exact;
 const alias=routeAliases[path];
 if(alias)return registry.find(route=>route.href===alias);
 if(path==='/staff'&&query.get('view')==='cases')return {label:'پرونده‌های ارجاع‌شده',group:'work',groupTitle:'کارتابل و برنامه‌ریزی',href:'/staff?view=cases'};
 // Hidden resource and legacy views stay reachable with a meaningful location.
 const resources:Record<string,string>={'/manage/lab':'منابع آزمایشگاه','/manage/tariffs':'بانک تعرفه و قوانین','/manage/management':'منابع مدیریت و توسعه'};
 if(resources[path])return {label:resources[path],group:'management',groupTitle:'مدیریت و راهبری پژوهشکده',href:path};
 return registry.find(route=>new URL(route.href,'https://synapse.local').pathname===path);
}
export function workspacePreviews(user:any){return workspaceNavigation(user).flatMap(group=>{
 const links=group.items.filter(item=>item.enabled);
 return links.length?[{id:group.id,title:group.label,description:groupDescriptions[group.id],href:links[0].href,links:links.slice(0,3)}]:[];
})}
