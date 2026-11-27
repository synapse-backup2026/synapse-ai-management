import test from 'node:test';import assert from 'node:assert/strict';
import {calculateDocument,currencyRial,balanced,needsScientificReview,canFinance,canApproveFinance,canQuote} from '../lib/finance-policy.ts';import {parseBankCSV} from '../lib/finance-csv.ts';
const p={client:'مشتری',lines:[{id:'1',description:'PCR',quantity:5,repeats:3,unit_price:10000,cost_total:40000}],discount:10000,tax_bps:1000,execution_min:100000};
test('Financial totals include repeats, discount, cost and configurable VAT',()=>{assert.deepEqual(calculateDocument(p),{subtotal:150000,discount:10000,net:140000,tax:14000,total:154000,cost:40000,margin:100000,margin_bps:7143});assert.throws(()=>calculateDocument({...p,installments:[{title:'one',amount:1,due:'2026-11-09'}]}));assert.throws(()=>calculateDocument({...p,lines:[...p.lines,...p.lines]}))});
test('Rial conversion and ledger balance never infer units',()=>{assert.equal(currencyRial(123,'IRT'),1230);assert.equal(currencyRial(123,'IRR'),123);assert.throws(()=>currencyRial(1.5,'IRT'));assert.throws(()=>currencyRial(1,'USD'));assert.ok(balanced([{account:'bank',debit:100,credit:0},{account:'revenue',debit:0,credit:100}]));assert.ok(!balanced([{account:'bank',debit:100},{account:'revenue',credit:101}]))});
test('Scientific reduction and laboratory exclusion',()=>{assert.ok(needsScientificReview(p,{...p,lines:[{...p.lines[0],repeats:1}]}));assert.ok(!canFinance({laboratory:true,manager:true,permissions:['finance_ops']}));assert.ok(!canFinance({permissions:['billing_ops']}));assert.ok(canFinance({permissions:['finance_ops']}))});
test('Bank CSV handles quoted commas, Persian digits and malformed input',()=>{assert.deepEqual(parseBankCSV('date,reference,amount_rial,description\n2026-11-09,r1,"۱,۲۳۴","a,b"')[0],{date:'2026-11-09',reference:'r1',amount_rial:1234,description:'a,b'});assert.throws(()=>parseBankCSV('date,reference,amount_rial,description\nd,r,abc,x'));assert.throws(()=>parseBankCSV('a,b\n1,2'))});

test('accountant cannot inherit broad finance or quote permissions', () => {
  const permissions = ['finance_ops', 'finance_approve', 'quote_ops'];
  const accountant = {username: 'accountant', dataPermissions: permissions};
  assert.equal(canFinance(accountant), false);
  assert.equal(canApproveFinance(accountant), false);
  assert.equal(canQuote(accountant), false);

  const manager = {...accountant, username: 'finance'};
  assert.equal(canFinance(manager), true);
  assert.equal(canApproveFinance(manager), true);
  assert.equal(canQuote(manager), true);
});
