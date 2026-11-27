import {isPrimaryOwner} from './work-assignment-policy.ts';

export type PolicyActor = {
  email?: string | null;
  local?: boolean;
  username?: string | null;
  role?: string | null;
  manager?: boolean;
  owner?: boolean;
  laboratory?: boolean | string | null;
  active?: boolean;
  permissions?: readonly string[];
};

export const ACCOUNTANT_USERNAME = 'accountant' as const;
export const SPECIALIST_USERNAME = 'specialist' as const;

export const ACCOUNTANT_PERMISSIONS = Object.freeze([
  'finance.read', 'finance.create', 'finance.corrections.request',
  'customer-finance.read', 'tickets.finance.read', 'tickets.finance.follow-up',
  'bank.read', 'bank-statements.read', 'tariffs.read',
] as const);

export const ACCOUNTANT_FORBIDDEN = Object.freeze([
  'finance.update-existing', 'finance.approve', 'finance.void', 'finance.delete',
  'bank.write', 'bank.reconcile', 'tariffs.write', 'accounts.manage',
  'scientific.read', 'research.read', 'admin.read',
] as const);

export const STAFF_LOGIN_BY_TITLE = Object.freeze({
  'مسئول علمی پروژه': 'scientific',
  'مسئول فنی پروژه': 'research',
  'کارشناس امور اداری': 'admin',
} as const);

export const INTAKE_CATEGORIES = Object.freeze([
  ['01', 'خدمات و ثبت سفارش‌ها'],
  ['02', 'پروژه‌های در حال اجرا'],
  ['03', 'نتایج و گزارش‌ها'],
  ['04', 'امور مالی مشتریان'],
  ['05', 'امور داخلی و اداری'],
  ['06', 'پشتیبانی فنی و فناوری اطلاعات'],
  ['07', 'مشاوره تخصصی پیش از سفارش'],
  ['08', 'مشاوره تخصصی اصلاح و تغییر سفارش'],
  ['09', 'مشاوره تخصصی حین اجرا'],
  ['10', 'مشاوره تخصصی نتایج و رفع اشکال'],
] as const);

const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function isOwner(actor: PolicyActor | null | undefined): boolean {
  if (!actor || actor.active === false) return false;
  return isPrimaryOwner(actor);
}

export function isAccountant(actor: PolicyActor | null | undefined): boolean {
  return Boolean(actor && actor.active !== false && !actor.laboratory && normalized(actor.username) === ACCOUNTANT_USERNAME);
}

export function isSpecialist(actor: PolicyActor | null | undefined): boolean {
  return Boolean(actor && actor.active !== false && normalized(actor.username) === SPECIALIST_USERNAME);
}

export function canManageAccounts(actor: PolicyActor | null | undefined): boolean {
  return isOwner(actor);
}

export function canDeactivate(actor: PolicyActor | null | undefined, targetUsername: string): boolean {
  return isOwner(actor) && normalized(targetUsername) !== 'owner';
}

export function canReadBank(actor: PolicyActor | null | undefined): boolean {
  return isOwner(actor) || isAccountant(actor);
}

export function canWriteBank(): false {
  return false;
}

export function canCreateFinance(actor: PolicyActor | null | undefined): boolean {
  return isOwner(actor) || isAccountant(actor);
}

export function canEditExistingFinance(actor: PolicyActor | null | undefined): false {
  return false;
}

export function canRequestCorrection(actor: PolicyActor | null | undefined): boolean {
  return isOwner(actor) || isAccountant(actor);
}

export function canDeleteRecord(actor: PolicyActor | null | undefined, target: { issued?: boolean; paid?: boolean; statutory?: boolean } = {}): boolean {
  if (!isOwner(actor)) return false;
  return !(target.issued || target.paid || target.statutory);
}

export function validateCorrectionRequest(input: unknown): { ok: true; value: { recordId: string; version: number; reason: string; proposal: unknown } } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'correction_request_required' };
  const value = input as Record<string, unknown>;
  const recordId = String(value.recordId ?? '').trim();
  const reason = String(value.reason ?? '').trim();
  const version = Number(value.version);
  if (!recordId || !Number.isInteger(version) || version < 1 || !reason || reason.length < 3) {
    return { ok: false, error: 'correction_request_invalid' };
  }
  return { ok: true, value: { recordId, version, reason, proposal: value.proposal ?? null } };
}

export function isReadOnlyAction(action: unknown): boolean {
  return new Set(['bank.read', 'bank-statements.read', 'tariffs.read']).has(String(action));
}

export function isKnownCategory(code: unknown): boolean {
  return INTAKE_CATEGORIES.some(([id]) => id === String(code));
}
