import { canDeleteData } from './deletion-policy';
import { db } from './staff-server';
import { check } from './integration-store';

const targets = {
  operation: { table: 'ops_items', filter: 'archived_at IS NULL', update: 'archived_at=?' },
  researcher: { table: 'researcher_sample_sheets', filter: 'archived_at IS NULL', update: 'archived_at=?' },
  staff: { table: 'staff_records', filter: "kind='sample_intake' AND status!='archived'", update: "updated_at=?, status='archived'" },
} as const;

export async function archiveIntake(user: Parameters<typeof canDeleteData>[0], kind: keyof typeof targets, id: unknown, revision: unknown) {
  check(canDeleteData(user), 'حذف فقط برای مالک اصلی سامانه مجاز است.', 403);
  check(typeof id === 'string' && id.length > 0 && id.length <= 160 && typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0, 'شناسه یا نسخهٔ پرونده معتبر نیست.', 400);
  const { table, filter, update } = targets[kind];
  const at = new Date().toISOString();
  const [result] = await db().batch([
    db().prepare(`UPDATE ${table} SET ${update}, revision=revision+1 WHERE id=? AND revision=? AND ${filter}`).bind(at, id, revision),
    db().prepare('INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1')
      .bind(crypto.randomUUID(), id, user.email, 'intake-archived', kind, at),
  ]);
  check(result.meta.changes === 1, 'پرونده پیدا نشد یا تغییر کرده است. فهرست را دوباره باز کنید.', 409);
  return { ok: true };
}
