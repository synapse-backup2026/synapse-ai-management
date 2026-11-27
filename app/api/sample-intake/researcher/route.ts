import { z } from "zod";
import { hasDataAccess } from "../../../../lib/auth-policy";
import { canDeleteData } from "../../../../lib/deletion-policy";
import { canCoordinate } from "../../../../lib/lab-execution-policy";
import { db, identity, json, mutationAllowed } from "../../../../lib/staff-server";

const text = z.string().max(4000);
const required = z.string().trim().min(1).max(250);
const choice = (min: number, max: number) => z.number().int().min(min).max(max);
const digits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (d) =>
  String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(d) % 10));
const numberText = (value: string) => digits(value).trim().replace("٫", ".");
const calendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});
function datePart(date: Date, part: Intl.DateTimeFormatPartTypes) {
  return Number(calendar.formatToParts(date).find((entry) => entry.type === part)?.value);
}

function validDate(year: string, month: string, day: string) {
  if (!/^\d{4}$/.test(year) || !/^(?:[1-9]|1[0-2])$/.test(month) || !/^[1-9]\d?$/.test(day)) return false;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1200 || y > datePart(new Date(), "year") + 1) return false;
  if (m < 7) return d <= 31;
  if (m < 12) return d <= 30;
  if (d <= 29) return true;
  if (d !== 30) return false;
  for (let march = 18; march <= 22; march++) {
    const date = new Date(Date.UTC(y + 622, 2, march));
    if (datePart(date, "year") === y && datePart(date, "month") === 12 && datePart(date, "day") === 30) return true;
  }
  return false;
}

function validQuantity(countInput: string, amountInput: string) {
  const count = numberText(countInput);
  const amount = numberText(amountInput);
  return /^\d+$/.test(count) && Number.isSafeInteger(Number(count)) && Number(count) > 0
    && /^\d+(?:\.\d+)?$/.test(amount) && Number(amount) > 0
    && Number.isFinite(Number(count) * Number(amount));
}

const material = z.object({
  kind: choice(0, 3), name: required, count: z.string().max(32), amount: z.string().max(80), unit: choice(0, 6),
}).refine((item) => validQuantity(item.count, item.amount));

const sample = z.object({
  type: choice(0, 10), name: text, species: choice(1, 6), originNotes: text, code: text,
  groups: z.array(z.string().max(250)).max(100), markerMode: choice(0, 3), markers: text,
  count: z.string().max(32), amount: z.string().max(80), unit: choice(0, 6),
  condition: choice(0, 4), container: text, year: z.string(), month: z.string(), day: z.string(),
  supplyMode: choice(1, 3), materials: z.array(material).max(100),
  assays: z.array(choice(0, 6)).min(1).max(7), otherTechnique: text, notes: text,
}).refine((s) => {
  return (s.type !== 10 || !!s.name.trim()) && (s.species !== 6 || !!s.originNotes.trim())
    && s.groups.length > 0 && s.groups.every((group) => !!group.trim())
    && validQuantity(s.count, s.amount) && validDate(s.year, s.month, s.day)
    && (s.supplyMode === 1 ? s.materials.length > 0 : s.materials.length === 0)
    && (!s.assays.includes(6) || !!s.otherTechnique.trim());
}).transform((s) => ({
  ...s,
  name: s.type === 10 ? s.name.trim() : "",
  originNotes: s.species === 6 ? s.originNotes.trim() : "",
  assays: [...new Set(s.assays)],
}));

const sheet = z.object({
  name: required, org: text, mobile: z.string().max(40).refine((value) =>
    /^(?:09|\+989|00989)\d{9}$/.test(digits(value).replace(/[\s()-]/g, ""))),
  invoice: required, email: z.string().trim().max(250).email(),
  samples: z.array(sample).min(1).max(100), delivery: choice(0, 3), temp: choice(0, 3),
  transport: text, biosafety: text, confirmed: z.literal(true),
});
const warehouse = "انبار نمونه‌های پژوهشی";
const revision = z.number().int().positive();
const id = z.string().uuid();
const payload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id, revision: z.number().int().nonnegative(), sheet }),
  z.object({ action: z.literal("destination"), id, revision, destination: z.string().max(320) }),
  z.object({ action: z.literal("delete"), id, revision }),
]);

type RecordRow = {
  id: string; sheet: string; destination: string; assigned_to: string; assigned_lab_id: string;
  revision: number; updated_at: string;
};
const fields = "id, sheet, destination, assigned_to, assigned_lab_id, revision, updated_at";
const publicRecord = (row: RecordRow, hideContact = false) => {
  const sheet = JSON.parse(row.sheet);
  if (hideContact) Object.assign(sheet, { email: "", mobile: "", org: "" });
  const destination = row.destination === "انبار" ? warehouse : row.destination;
  return {
    id: row.id, sheet, destination,
    destinationKey: row.assigned_lab_id ? `lab:${row.assigned_lab_id}`
      : row.assigned_to ? `staff:${row.assigned_to}` : destination === warehouse ? "warehouse" : "",
    revision: row.revision, updatedAt: row.updated_at,
  };
};

async function access() {
  const user = await identity();
  if (!user) return null;
  const isOwner = canDeleteData(user);
  const all = !user.laboratory && (isOwner || canCoordinate(user) || hasDataAccess(user, "research_supervision"));
  return {
    user, isOwner, all, canCreate: all || (!user.laboratory && hasDataAccess(user, "sample_intake")),
  };
}
const forbidden = () => json({ error: "دسترسی به این عملیات مجاز نیست." }, 403);
const indexedStaff = "SELECT m.email AS id, m.name FROM staff_members m JOIN staff_accounts a ON a.member_id=m.email WHERE m.active=1 AND NOT EXISTS (SELECT 1 FROM laboratory_members l WHERE l.member_id=m.email)";
const activeLabs = "SELECT id, name FROM laboratories WHERE status='active'";
type Target = { id: string; name: string };

async function resolveDestination(value: string) {
  if (!value) return { label: "", person: "", lab: "" };
  if (value === "warehouse" || value === "انبار") return { label: warehouse, person: "", lab: "" };
  if (value.startsWith("lab:")) {
    const lab = await db().prepare(activeLabs + " AND id=?").bind(value.slice(4)).first<Target>();
    if (lab) return { label: lab.name, person: "", lab: lab.id };
  }
  if (value.startsWith("staff:")) {
    const staff = await db().prepare(indexedStaff + " AND m.email=?").bind(value.slice(6)).first<Target>();
    if (staff) return { label: staff.name, person: staff.id, lab: "" };
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const accessInfo = await access();
    if (!accessInfo) return forbidden();
    const { user, isOwner, all, canCreate } = accessInfo;
    const referralsOnly = new URL(request.url).searchParams.get("mode") === "referrals" || !canCreate;
    const store = db();
    const rows = user.laboratory
      ? await store.prepare(`SELECT ${fields} FROM researcher_sample_sheets WHERE deleted_at IS NULL AND assigned_lab_id=?`).bind(user.laboratoryId).all<RecordRow>()
      : await store.prepare(`SELECT ${fields} FROM researcher_sample_sheets WHERE deleted_at IS NULL AND
          ((assigned_to<>'' AND assigned_to=?) OR
           (?=1 AND destination IN (?, 'انبار')) OR
           (?=0 AND (created_by=? OR ?=1)))`)
        .bind(user.email, all ? 1 : 0, warehouse, referralsOnly ? 1 : 0, user.email, all ? 1 : 0).all<RecordRow>();
    const [labs, staff] = all && !referralsOnly
      ? await Promise.all([store.prepare(activeLabs + " ORDER BY name").all<Target>(),
        store.prepare(indexedStaff + " ORDER BY m.name").all<Target>()])
      : [{ results: [] }, { results: [] }];
    return json({
      records: rows.results.map((row) => publicRecord(row, !!user.laboratory)),
      canCreate: canCreate && !referralsOnly, canEdit: isOwner && !referralsOnly,
      canRefer: all && !referralsOnly,
      destinations: [
        { group: "انبار", key: "warehouse", name: warehouse },
        ...labs.results.map((lab) => ({ group: "آزمایشگاه‌ها", key: `lab:${lab.id}`, name: lab.name })),
        ...staff.results.map((member) => ({ group: "مسئولان", key: `staff:${member.id}`, name: member.name })),
      ],
    });
  } catch {
    return json({ error: "خواندن پرونده‌ها انجام نشد." }, 500);
  }
}

export async function POST(request: Request) {
  if (!mutationAllowed(request)) return forbidden();
  try {
    const accessInfo = await access();
    if (!accessInfo) return forbidden();
    const { user, isOwner, all, canCreate } = accessInfo;
    if (!canCreate) return forbidden();
    const raw = await request.text();
    if (raw.length > 1000000) return json({ error: "حجم اطلاعات برگه بیش از حد مجاز است." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "اطلاعات برگه نامعتبر است." }, 400); }
    const parsed = payload.safeParse(body);
    if (!parsed.success) return json({ error: "مشخصات برگه یا نمونه‌ها کامل و معتبر نیست." }, 400);
    const value = parsed.data;
    const updatedAt = new Date().toISOString();
    const store = db();
    if ((value.action === "delete" || value.action === "save" && value.revision > 0) && !isOwner) return forbidden();
    if (value.action === "destination" && !all) return forbidden();
    const scope = [value.id, value.revision] as const;
    let result;
    if (value.action === "delete" || value.action === "destination") {
      const target = value.action === "destination" ? await resolveDestination(value.destination) : null;
      if (value.action === "destination" && !target) return json({ error: "مقصد ارجاع فعال و معتبر نیست." }, 400);
      const mutation = target
        ? store.prepare(
          "UPDATE researcher_sample_sheets SET destination=?, assigned_to=?, assigned_lab_id=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL",
        ).bind(target.label, target.person, target.lab, updatedAt, ...scope)
        : store.prepare(
          "UPDATE researcher_sample_sheets SET deleted_at=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL",
        ).bind(updatedAt, updatedAt, ...scope);
      [result] = await store.batch([mutation,
        store.prepare("INSERT INTO staff_events(id,record_id,actor,action,body,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1")
          .bind(crypto.randomUUID(), value.id, user.email, target ? "sample-referred" : "sample-sheet-deleted",
            JSON.stringify(target || {}), updatedAt)]);
      if (value.action === "delete") return result.meta.changes
        ? json({ ok: true }) : json({ error: "برگه پیدا نشد یا تغییر کرده است." }, 409);
    } else {
      result = value.revision === 0
        ? await store.prepare("INSERT OR IGNORE INTO researcher_sample_sheets (id, created_by, sheet, updated_at) VALUES (?, ?, ?, ?)")
          .bind(value.id, user.email, JSON.stringify(value.sheet), updatedAt).run()
        : await store.prepare("UPDATE researcher_sample_sheets SET sheet=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL")
          .bind(JSON.stringify(value.sheet), updatedAt, ...scope).run();
    }
    const row = await store.prepare(
      `SELECT ${fields} FROM researcher_sample_sheets WHERE id=? AND deleted_at IS NULL AND (created_by=? OR ?=1)`,
    ).bind(value.id, user.email, all ? 1 : 0).first<RecordRow>();
    if (!row) return json({ error: "برگه در دسترس نیست." }, 404);
    if (!result.meta.changes) {
      if (value.action === "save" && value.revision === 0 && row.sheet === JSON.stringify(value.sheet)) {
        return json({ record: publicRecord(row) });
      }
      return json({ error: "برگه تغییر کرده است. آن را دوباره از فهرست باز کنید." }, 409);
    }
    return json({ record: publicRecord(row) });
  } catch {
    return json({ error: "ذخیرهٔ برگه انجام نشد." }, 500);
  }
}
