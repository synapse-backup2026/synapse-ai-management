import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceServiceLines} from '../lib/laboratory-invoice-lines.ts';

test('returns all invoice rows in their own domain and keeps duplicates by line ID', () => {
 const areas = [['مطالعات حیوانی',3],['بافت‌شناسی و پاتولوژی',10],['تکنیک‌های سلولی',5]];
 const source = areas.flatMap(([area,count]) => Array.from({length:count},(_,i) => ({
  id:area + i,area,description:'خدمت مشترک',quantity:2,repeats:3,unit:'نمونه',unit_price:100000,
 })));
 const rows = invoiceServiceLines(source,[]);
 assert.equal(rows.length,18);
 assert.deepEqual(Object.fromEntries(['animal','histology','cell-molecular'].map(domain => [domain,rows.filter(row => row.domain===domain).length])),
  {animal:3,histology:10,'cell-molecular':5});
 assert.deepEqual(rows.map(row => row.id),source.map(line => line.id));
 assert.equal(rows[0].quantity,2);
 assert.equal(rows[0].repeats,3);
 assert.equal('unit_price' in rows[0], false);
});

test('uses an exact tariff reference and leaves unresolved shared or conflicting areas for review', () => {
 const row={id:'line',description:'خدمت',quantity:1,unit:'خدمت',repeats:1,area:'مولکولی و پروتئینی'};
 const catalog=[{tariff_id:'WB:WB-001',title:'عنوان متفاوت',domain:'protein-biochemistry'}];
 assert.equal(invoiceServiceLines([row],catalog)[0].domain,'');
 assert.equal(invoiceServiceLines([{...row,tariff_id:catalog[0].tariff_id}],catalog)[0].domain,'protein-biochemistry');
 assert.equal(invoiceServiceLines([{...row,area:'پاتولوژی',tariff_id:catalog[0].tariff_id}],catalog)[0].domain,'');
});
