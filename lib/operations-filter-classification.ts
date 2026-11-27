import {intakeResponsibleRoles,unifiedIntakeCategories} from './unified-intake-taxonomy.ts';
// Filter-only compatibility. Never writes metadata, changes ownership or grants access.
const quote=(v:string)=>"'"+v.replace(/'/g,"''")+"'";
const legacy:Record<string,Record<string,string>>={
 customers:{'ثبت سفارش':'service_orders','درخواست اصلاح فاکتور':'service_orders','مشاوره پیش از سفارش':'consult_before','تحویل نمونه':'service_orders'},
 billing:{'فاکتورهای ارسال‌شده':'service_orders','پیش‌نویس فاکتور — ارسال‌نشده':'service_orders','واریزی‌های مشتریان':'service_finance','اعلام واریز یا فیش — منتظر تأیید بانک':'service_finance','صورتحساب و مانده پرداخت':'service_finance','مغایرت پرداخت و پیگیری مانده':'service_finance','لغو سفارش و استرداد وجه':'service_finance'},
 results:{'نتایج ارسال‌شده':'service_results','مشاوره و رفع اشکال نتایج':'consult_results','درخواست رفع اشکال و اطلاعات تکمیلی':'service_results'},
 projects:{'اجرای پروژه و پیگیری آزمایشگاه‌ها':'service_projects'},
 internal:{'استخدام و همکاری علمی':'service_admin','امور داخلی و مدیریت':'service_admin','تنخواه و هزینه‌های جاری':'service_finance','هزینه‌های خدمات و خرید شرکت':'service_finance'},
 system:{'مشکلات سایت و فرم سفارش':'service_it','اطلاع‌رسانی و تبلیغات':'service_it','امنیت حساب و دسترسی سامانه':'service_it'}
};
const known=unifiedIntakeCategories.map(c=>quote(c.id)).join(',');
const label=(key:string)=>"COALESCE(NULLIF(json_extract(source_labels,'$.intake_"+key+"'),''),NULLIF(json_extract(source_labels,'$.ticket_"+key+"'),''))";
const legacyCases=Object.entries(legacy).flatMap(([cat,items])=>Object.entries(items).map(([sub,id])=>"WHEN category="+quote(cat)+" AND subtype="+quote(sub)+" THEN "+quote(id))).join(' ');
const catLabel=label('category');
// Legacy records often have a broad canonical category and a free-form subtype.
// Resolve only the read-side facet; preserve original classification and access policy.
const broad:Record<string,string>={customers:'service_orders',billing:'service_finance',results:'service_results',projects:'service_projects',internal:'service_admin'};
const broadCases=Object.entries(broad).map(([cat,id])=>"WHEN category="+quote(cat)+" THEN "+quote(id)).join(' ');
const oldLabelCases=Object.entries({orders:'service_orders',invoices:'service_orders',payments:'service_finance',results:'service_results',projects:'service_projects',internal:'service_admin',system:'service_it',collaboration:'service_admin',proposal:'consult_before',organization:'service_admin'}).map(([cat,id])=>"WHEN "+catLabel+"="+quote(cat)+" THEN "+quote(id)).join(' ');
export const filterCategorySQL="(CASE WHEN "+catLabel+" IN ("+known+") THEN "+catLabel+" "+legacyCases+" "+oldLabelCases+" WHEN category='system' AND subtype IN ('نیازمند بررسی','گزارش روزانه ایمیل‌ها') THEN NULL "+broadCases+" ELSE NULL END)";
export const filterGroupSQL="(CASE "+filterCategorySQL+" "+unifiedIntakeCategories.map(c=>"WHEN "+quote(c.id)+" THEN "+quote(c.group)).join(' ')+" ELSE NULL END)";
const explicitRole=label('role');
const legacyTopic:Record<string,Record<string,string>>={
 customers:{'ثبت سفارش':'درخواست خدمات پژوهشی','تحویل نمونه':'تحویل نمونه یا مواد پروژه'},
 billing:{'واریزی‌های مشتریان':'پرداخت‌ها و واریزی‌ها','صورتحساب و مانده پرداخت':'اعلام مانده حساب','مغایرت پرداخت و پیگیری مانده':'مغایرت پرداخت‌ها'},
 results:{'نتایج ارسال‌شده':'نحوه ارسال نتایج'},
 projects:{'اجرای پروژه و پیگیری آزمایشگاه‌ها':'پیگیری پیشرفت پروژه'},
 internal:{'استخدام و همکاری علمی':'استخدام و همکاری','امور داخلی و مدیریت':'ارتباط با مدیریت'},
 system:{'مشکلات سایت و فرم سفارش':'مشکلات فرم سامانه','امنیت حساب و دسترسی سامانه':'مشکل حساب کاربری'},
};
const mappedTopics=Object.entries(legacyTopic).flatMap(([cat,items])=>Object.entries(items).map(([sub,topic])=>"WHEN category="+quote(cat)+" AND subtype="+quote(sub)+" THEN "+quote(topic))).join(' ');
const rawTopic=label('topic');
export const filterTopicSQL="COALESCE("+rawTopic+",(CASE "+mappedTopics+" ELSE NULLIF(subtype,'') END))";
const exactCases=unifiedIntakeCategories.flatMap(c=>c.topics.map(t=>{
 const topic=/^سایر/.test(t.title)?rawTopic:filterTopicSQL;
 return "WHEN "+filterCategorySQL+"="+quote(c.id)+" AND "+topic+"="+quote(t.title)+" THEN "+quote(t.role);
})).join(' ');
// Topic and safe historical subtype mappings are for display only.
export const filterRoleSQL="(CASE WHEN "+explicitRole+" IN ("+intakeResponsibleRoles.map(r=>quote(r.id)).join(',')+") THEN "+explicitRole+" "+exactCases+" WHEN "+filterCategorySQL+"='consult_before' AND subtype='مشاوره پیش از سفارش' THEN 'technical_project' ELSE NULL END)";
