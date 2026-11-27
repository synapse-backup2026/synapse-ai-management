import { z } from "zod";
import { hasDataAccess } from "../../../../lib/auth-policy";
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

const sample = z.object({
  type: choice(0, 10), name: text, species: choice(1, 6), originNotes: text, code: text,
  groups: z.array(z.string().max(250)).max(100), markerMode: choice(0, 3), markers: text,
  count: z.string().max(32), amount: z.string().max(80), unit: choice(0, 6),
  condition: choice(0, 4), container: text, year: z.string(), month: z.string(), day: z.string(),
  assays: z.array(choice(0, 6)).max(7), otherTechnique: text, notes: text,
}).refine((s) => {
  const count = numberText(s.count);
  const amount = numberText(s.amount);
  return (s.type !== 10 || !!s.name.trim()) && (s.species !== 6 || !!s.originNotes.trim())
    && /^\d+$/.test(count) && Number.isSafeInteger(Number(count)) && Number(count) > 0
    && /^\d+(?:\.\d+)?$/.test(amount) && Number(amount) > 0 && Number.isFinite(Number(count) * Number(amount))
    && validDate(s.year, s.month, s.day);
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
const destinations = z.enum(["", "انبار", "آزمایشگاه مطالعات حیوانی", "آزمایشگاه بافت‌شناسی",
  "آزمایشگاه سلولی و مولکولی", "آزمایشگاه پروتئینی و بیوشیمی",
  "آزمایشگاه میکروبیولوژی", "سایر خدمات آزمایشگاهی"]);
const id = z.string().uuid();
const payload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id, revision: z.number().int().nonnegative(), sheet }),
  z.object({ action: z.literal("destination"), id, revision: z.number().int().positive(), destination: destinations }),
]);

type RecordRow = { id: string; sheet: string; destination: string; revision: number; updated_at: string };
const publicRecord = (row: RecordRow) => ({
  id: row.id, sheet: JSON.parse(row.sheet), destination: row.destination, revision: row.revision, updatedAt: row.updated_at,
});

async function access() {
  const user = await identity();
  if (!user || user.laboratory) return null;
  const all = user.manager || canCoordinate(user) || hasDataAccess(user, "research_supervision");
  return all || hasDataAccess(user, "sample_intake") ? { email: user.email, all } : null;
}
const forbidden = () => json({ error: "دسترسی به برگه‌های پژوهشگر ندارید." }, 403);

export async function GET() {
  try {
    const user = await access();
    if (!user) return forbidden();
    const rows = await db().prepare(
      "SELECT id, sheet, destination, revision, updated_at FROM researcher_sample_sheets WHERE (created_by=? OR ?=1)",
    ).bind(user.email, user.all ? 1 : 0).all<RecordRow>();
    return json({ records: rows.results.map(publicRecord) });
  } catch {
    return json({ error: "خواندن پرونده‌ها انجام نشد." }, 500);
  }
}

export async function POST(request: Request) {
  if (!mutationAllowed(request)) return forbidden();
  try {
    const user = await access();
    if (!user) return forbidden();
    const raw = await request.text();
    if (raw.length > 1000000) return json({ error: "حجم اطلاعات برگه بیش از حد مجاز است." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "اطلاعات برگه نامعتبر است." }, 400); }
    const parsed = payload.safeParse(body);
    if (!parsed.success) return json({ error: "مشخصات برگه یا نمونه‌ها کامل و معتبر نیست." }, 400);
    const value = parsed.data;
    const updatedAt = new Date().toISOString();
    const store = db();
    const scope = [value.id, value.revision, user.email, user.all ? 1 : 0] as const;
    const result = value.action === "destination"
      ? await store.prepare(
        "UPDATE researcher_sample_sheets SET destination=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? AND (created_by=? OR ?=1)",
      ).bind(value.destination, updatedAt, ...scope).run()
      : value.revision === 0
        ? await store.prepare(
          "INSERT OR IGNORE INTO researcher_sample_sheets (id, created_by, sheet, updated_at) VALUES (?, ?, ?, ?)",
        ).bind(value.id, user.email, JSON.stringify(value.sheet), updatedAt).run()
        : await store.prepare(
          "UPDATE researcher_sample_sheets SET sheet=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? AND (created_by=? OR ?=1)",
        ).bind(JSON.stringify(value.sheet), updatedAt, ...scope).run();
    // A failed conditional UPDATE must never be treated as a successful save,
    // even if another writer changed the row before the follow-up SELECT.
    if (!result.meta.changes) {
      if (value.action === "save" && value.revision === 0) {
        const existing = await store.prepare(
          "SELECT id, sheet, destination, revision, updated_at FROM researcher_sample_sheets WHERE id=? AND created_by=?",
        ).bind(value.id, user.email).first<RecordRow>();
        if (existing && existing.revision === 1 && existing.sheet === JSON.stringify(value.sheet)) {
          return json({ record: publicRecord(existing) });
        }
      }
      return json({ error: "برگه تغییر کرده است. آن را دوباره از فهرست باز کنید." }, 409);
    }
    const row = await store.prepare(
      "SELECT id, sheet, destination, revision, updated_at FROM researcher_sample_sheets WHERE id=? AND (created_by=? OR ?=1)",
    ).bind(value.id, user.email, user.all ? 1 : 0).first<RecordRow>();
    if (!row) return json({ error: "برگه در دسترس نیست." }, 404);
    return json({ record: publicRecord(row) });
  } catch {
    return json({ error: "ذخیرهٔ برگه انجام نشد." }, 500);
  }
}
