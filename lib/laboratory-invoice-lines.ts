import {laboratoryDomains} from './laboratory-center-policy.ts';

export type InvoiceServiceLine = {
 id: string;
 description: string;
 quantity: number;
 unit: string;
 repeats: number;
 domain: string;
 tariffId?: string;
 area: string;
};

type ServiceReference = {tariff_id: string; title: string; domain: string};
type StoredLine = Omit<InvoiceServiceLine, 'domain'|'tariffId'> & {tariff_id?: string};
const normalize = (s: string) => s.normalize('NFKC').replace(/[\s\u200c]+/g, ' ').trim();

export function invoiceServiceLines(lines: StoredLine[], catalog: ServiceReference[]): InvoiceServiceLine[] {
 return lines.map(line => {
  const area = normalize(line.area || '');
  const areaDomains = laboratoryDomains.filter(d => [d.id, ...d.areas, ...d.departments].some(value => normalize(value) === area));
  const tariff = line.tariff_id && catalog.find(service => service.tariff_id === line.tariff_id);
  const matchingDomains = new Set(catalog.filter(service => normalize(service.title) === normalize(line.description)).map(service => service.domain));
  const domain = tariff
   ? (!areaDomains.length || areaDomains.some(d => d.id === tariff.domain) ? tariff.domain : '')
   : areaDomains.length === 1 ? areaDomains[0].id
   : matchingDomains.size === 1 && (!areaDomains.length || areaDomains.some(d => matchingDomains.has(d.id))) ? [...matchingDomains][0]
   : '';
  return {id: line.id, description: line.description, quantity: line.quantity, unit: line.unit || 'خدمت', repeats: line.repeats || 1, area: line.area || '', domain, tariffId:line.tariff_id || undefined};
 });
}
