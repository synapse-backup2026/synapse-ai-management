import {jobMetadata, laboratoryDomains} from './laboratory-center-policy';
import {canCoordinate} from './lab-execution-policy';
import {db} from './staff-server';

function invoiceKey(value: unknown) {
  return String(value ?? '').trim().replace(/[۰-۹٠-٩]/g, digit =>
    String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)));
}

export async function readLabReferrals(user: any, domainId: string | null, jobs: any[]) {
  const domain = laboratoryDomains.find(entry => entry.id === domainId);
  if (!domain || (!user.laboratory && !canCoordinate(user))) return [];
  const labs = await db().prepare(
    'SELECT id,name,areas FROM laboratories' + (user.laboratory ? ' WHERE id=?' : '')
  ).bind(...(user.laboratory ? [user.laboratoryId] : [])).all<{id: string; name: string; areas: string}>();
  const labIds = new Map(labs.results.filter(lab =>
    JSON.parse(lab.areas).some((area: string) => domain.areas.includes(area))
  ).map(lab => [lab.id, lab.name]));
  if (!labIds.size) return [];

  const invoices = new Map<string, Set<string>>();
  for (const job of jobs) {
    const project = jobMetadata(job).mother_project;
    const invoice = invoiceKey(job.reference);
    if (!project || !invoice) continue;
    const key = JSON.stringify([job.laboratory_id, invoice]);
    const projects = invoices.get(key) ?? new Set<string>();
    projects.add(project);
    invoices.set(key, projects);
  }

  const {results} = await db().prepare(
    'SELECT id,sheet,assigned_lab_id,updated_at FROM researcher_sample_sheets ' +
    'WHERE deleted_at IS NULL AND assigned_lab_id IN (SELECT value FROM json_each(?)) ' +
    'ORDER BY updated_at DESC LIMIT 1000'
  ).bind(JSON.stringify([...labIds.keys()])).all<{
    id: string; sheet: string; assigned_lab_id: string; updated_at: string;
  }>();
  return results.map(row => {
    const sheet = JSON.parse(row.sheet);
    const invoice = invoiceKey(sheet.invoice);
    const matches = invoices.get(JSON.stringify([row.assigned_lab_id, invoice]));
    return {
      id: row.id,
      invoice,
      labId: row.assigned_lab_id,
      laboratory: labIds.get(row.assigned_lab_id),
      updatedAt: row.updated_at,
      projectId: matches?.size === 1 ? [...matches][0] : null,
      items: (sheet.samples ?? []).map(({code, name}: {code: string; name: string}) => ({code, name})),
    };
  });
}
