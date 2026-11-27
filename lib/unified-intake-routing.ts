import {intakeDefaultResponsibility,type IntakeRoleId} from './unified-intake-taxonomy.ts';

/** Exact operational positions only. The nine display labels never grant account access.
 * For split, project-specific or vacant roles, always queue manager triage instead. */
const exactApprovedPositions:Partial<Record<IntakeRoleId,string>>={
 scientific_reception:'customer_manager',
 finance_manager:'finance_manager',
 administrative:'administration_manager',
 it_specialist:'it_security_manager',
};
export function unifiedPosition(role:IntakeRoleId):string{
 return exactApprovedPositions[role]||'unified_pending_'+role;
}
export const isUnifiedPendingPosition=(code:string)=>code.startsWith('unified_pending_');
export function verifiedUnifiedClassification(category:string,topic:string){
 const classification=intakeDefaultResponsibility(category,topic);
 if(!classification)throw new Error('دسته و موضوع مصوب معتبر نیست.');
 return {...classification,position:unifiedPosition(classification.role),version:2 as const};
}
export function normalizeIranPhone(raw:string){
 const n=String(raw||'').replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632))).replace(/[\s()\-]/g,'');
 const local=n.startsWith('+98')?'0'+n.slice(3):n.startsWith('0098')?'0'+n.slice(4):n;
 return /^09[0-9]{9}$/.test(local)?local:'';
}
export function validPersianContactName(raw:string){
 const name=String(raw||'').trim().replace(/\s+/g,' ');
 return name.length<=160&&/^[\p{Script=Arabic}\u200c\s]+$/u.test(name)&&!/[^\p{L}\p{M}\u200c\s]/u.test(name)&&name.split(/\s+/).filter(Boolean).length>=2;
}
export function validOptionalEmail(raw:string){
 return !raw||raw.length<=200&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Existing access entitlements only: role labels do not bypass any record permission. */
export function unifiedRequiredAccess(category:string){
 return category==='service_finance'?'billing_ops':
 category==='service_admin'?'administration_ops':
 category==='service_it'?'security_ops':
 category==='service_results'?'results_ops':
 category.startsWith('consult_')?'projects':'operations';
}

/** Non-throwing catalog-only resolution for previews and triage.
 * Existing verifiedUnifiedClassification remains the strict write-path contract.
 */
export function resolveInitialResponsibility(categoryId:string,topicTitle:string){
 const classification=intakeDefaultResponsibility(categoryId,topicTitle);
 if(!classification)return {status:'needs_review' as const,categoryId,topicTitle,reason:'دسته یا موضوع مصوب معتبر نیست.'};
 return {status:'resolved' as const,roleId:classification.role,roleLabel:classification.label,categoryId,topicTitle};
}
