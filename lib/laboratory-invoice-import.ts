import {db} from './staff-server';
import {check,IntegrationError} from './integration-store';
import {canMother,motherProject} from './laboratory-mother';
import {invoiceKey} from './laboratory-case-policy';
import {invoiceServiceLines} from './laboratory-invoice-lines';

type Invoice = {id:string;number:string;version:number;revision:number;payload:string};

function equivalentNumbers(number: string) {
 const substitute = (digits: string) => number.replace(/[0-9]/g, d => digits[Number(d)]);
 return [number, substitute('۰۱۲۳۴۵۶۷۸۹'), substitute('٠١٢٣٤٥٦٧٨٩')];
}

async function invoiceByNumber(number: string): Promise<Invoice> {
 const key = invoiceKey(number);
 check(key && key.length <= 180, 'شماره فاکتور معتبر وارد کنید.');
 const variants = equivalentNumbers(key);
 const result = await db().prepare(`SELECT d.id,d.number,d.version,d.revision,d.payload FROM finance_documents d
   WHERE d.kind='invoice' AND d.status='issued' AND (
     UPPER(TRIM(d.number)) IN (?,?,?) OR EXISTS (
       SELECT 1 FROM finance_tax_records t WHERE t.document_id=d.id AND t.kind='official_invoice' AND t.status='accepted'
         AND UPPER(TRIM(t.official_number)) IN (?,?,?)
     )
   ) LIMIT 2`).bind(...variants,...variants).all<Invoice>();
 check(result.results.length < 2, 'این شماره به بیش از یک فاکتور می‌رسد. شماره داخلی فاکتور را وارد کنید.',409);
 check(result.results.length, 'فاکتور صادرشده با این شماره پیدا نشد. شماره را بررسی کنید یا ثبت دستی را انتخاب کنید.',404);
 return result.results[0];
}

function readLines(invoice: Invoice, catalog: Parameters<typeof invoiceServiceLines>[1]) {
 const {lines,client,due,project_id} = JSON.parse(invoice.payload);
 check(Array.isArray(lines) && lines.length && lines.length <= 1000 && new Set(lines.map(line => line?.id)).size === lines.length
   && lines.every(line => typeof line?.id === 'string' && line.id && typeof line.description === 'string'
     && line.description.trim() && line.description.length <= 240 && Number.isSafeInteger(line.quantity)
     && line.quantity > 0 && line.quantity <= 100000 && typeof (line.unit || '') === 'string' && (line.unit || '').length <= 60),
   'یک یا چند ردیف فاکتور برای ثبت عملیاتی معتبر نیست. ردیف‌ها در بخش مالی بررسی شوند.',409);
 return {client:String(client||''), due:String(due||''), projectId:String(project_id||''), lines:invoiceServiceLines(lines,catalog)};
}

export async function previewCaseInvoice(u: any, number: string, catalog: Parameters<typeof invoiceServiceLines>[1], draftId = '') {
 check(canMother(u), 'دسترسی به ثبت پرونده ندارید.',403);
 const invoice = await invoiceByNumber(number);
 const {client,due,projectId,lines} = readLines(invoice,catalog);
 const existing = await db().prepare(`SELECT r.id FROM staff_records r
   JOIN staff_work_details w ON w.record_id=r.id WHERE r.kind='project' AND
   (json_extract(w.details,'$.mother.invoice_key')=? OR json_extract(w.details,'$.mother.invoice_id')=?) LIMIT 1`)
  .bind(invoiceKey(invoice.number),invoice.id).first<{id:string}>();
 const existingId = projectId || existing?.id;
 if (existingId && existingId !== draftId) {
  try { await motherProject(u,existingId); } catch (error) {
   if (error instanceof IntegrationError && [403,404].includes(error.status))
    throw new IntegrationError('این فاکتور به پرونده‌ای متصل است. برای ادامه با مسئول پرونده هماهنگ کنید.',409);
   throw error;
  }
  return {existingId};
 }
 return {id:invoice.id,number:invoice.number,version:invoice.version,revision:invoice.revision,client,due,lines};
}

export async function checkedInvoiceAssignments(u: any, b: any, catalog: Parameters<typeof invoiceServiceLines>[1]) {
 if (!b.invoice_source) return b.assignments;
 check(canMother(u), 'دسترسی به ثبت پرونده ندارید.',403);
 const invoice = await invoiceByNumber(b.invoice_number);
 check(invoiceKey(invoice.number)===invoiceKey(b.invoice_number) && invoice.id===b.invoice_source.id && invoice.version===b.invoice_source.version && invoice.revision===b.invoice_source.revision,
   'فاکتور تغییر کرده است. ردیف‌ها را دوباره از مالی دریافت کنید.',409);
 const {projectId,lines} = readLines(invoice,catalog);
 check(!projectId||projectId===b.id, 'فاکتور به پروندهٔ دیگری متصل است.',409);
 const original = new Map(lines.map(line => [line.id,line]));
 const excluded = b.invoice_source.excluded ?? [];
 check(Array.isArray(excluded) && excluded.every(id => original.has(id) && !original.get(id)!.domain)
   && new Set(excluded).size === excluded.length, 'ردیف‌های خارج از دامنه معتبر نیستند.');
 for (const id of excluded) original.delete(id);
 check(Array.isArray(b.assignments) && b.assignments.length, 'حداقل یک حوزه برای ردیف‌های فاکتور انتخاب کنید.');
 const mapped = b.assignments.map((assignment: any) => {
  check(Array.isArray(assignment?.services), 'فهرست ردیف‌های فاکتور معتبر نیست.');
  const services = assignment.services.map((service: any) => {
   const line = original.get(service?.invoice_line_id);
   if (!line || line.domain && line.domain !== assignment.domain)
    throw new IntegrationError('ردیف یا حوزه با فاکتور تطابق ندارد. ردیف‌ها را دوباره بررسی کنید.',409);
   original.delete(line.id);
   return {invoice_line_id:line.id,description:line.description,quantity:line.quantity,unit:line.unit,repeats:line.repeats, invoice_tariff_id:line.tariffId || ''};
  });
  return {...assignment,services};
 });
 check(!original.size, 'تکلیف همهٔ ردیف‌های فاکتور را مشخص کنید.');
 return mapped;
}
