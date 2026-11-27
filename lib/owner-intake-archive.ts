import { canDeleteData } from './deletion-policy';
import { db } from './staff-server';
import { check } from './integration-store';

const targets = {
  operation: { table: 'ops_items', filter: 'archived_at IS NULL', update: 'archived_at=?' },
  staff: { table: 'staff_records', filter: "kind='sample_intake' AND status!='archived'", update: "updated_at=?, status='archived'" },
} as const;

const financialLinks = "SELECT COUNT(*) AS count FROM finance_links l JOIN finance_documents d ON d.id=l.document_id WHERE l.reference_id=? AND l.type='operation:'||l.reference_id AND d.status!='cancelled'";

export async function previewOperationArchive(user: Parameters<typeof canDeleteData>[0], id: unknown) {
  check(canDeleteData(user), 'بایگانی فقط برای مالک اصلی سامانه مجاز است.', 403);
  check(typeof id === 'string' && id.length > 0 && id.length <= 160, 'شناسه نامعتبر است.', 400);
  const store=db();
  const record=await store.prepare('SELECT id, title, revision FROM ops_items WHERE id=? AND archived_at IS NULL').bind(id).first();
  check(record, 'رکورد در دسترس نیست.', 404);
  const [messages, documents]=await Promise.all([
    store.prepare('SELECT COUNT(*) AS count FROM ops_communications WHERE request_id=?').bind(id).first<{count:number}>(),
    store.prepare(financialLinks).bind(id).first<{count:number}>(),
  ]);
  return {record, messages:Number(messages?.count??0), documents:Number(documents?.count??0)};
}

export async function archiveIntake(user: Parameters<typeof canDeleteData>[0], kind: keyof typeof targets, id: unknown, revision: unknown, reason: unknown, confirmed: unknown) {
  check(canDeleteData(user), 'حذف فقط برای مالک اصلی سامانه مجاز است.', 403);
  check(typeof id === 'string' && id.length > 0 && id.length <= 160 && typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0, 'شناسه یا نسخهٔ پرونده معتبر نیست.', 400);
  check(confirmed === true && typeof reason === 'string' && reason.trim().length >= 4 && reason.length <= 1000, 'دلیل و تأیید بایگانی لازم است.', 400);
  const { table, filter, update } = targets[kind];
  const guard=kind==='operation'? ` AND NOT EXISTS (SELECT 1 FROM finance_links l JOIN finance_documents d ON d.id=l.document_id WHERE l.reference_id=ops_items.id AND l.type='operation:'||l.reference_id AND d.status!='cancelled')`:'';
  const at = new Date().toISOString();
  const [result] = await db().batch([
    db().prepare(`UPDATE ${table} SET ${update}, revision=revision+1 WHERE id=? AND revision=? AND ${filter}${guard}`).bind(at, id, revision),
    db().prepare('INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1')
      .bind(crypto.randomUUID(), id, user.email, 'intake-archived', JSON.stringify({kind, revision, reason: String(reason).trim()}), at),
  ]);
  check(result.meta.changes === 1, 'پرونده تغییر کرده، در دسترس نیست یا سند مالی فعال دارد.', 409);
  return { ok: true };
}
