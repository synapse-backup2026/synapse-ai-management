import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../lib/accountant-owner-policy.ts';

const owner = { username: 'owner', role: 'owner', manager: true, local: true, email: 'ekramiihamid@gmail.com', active: true };
const accountant = { username: 'accountant', role: 'accountant', active: true };
const specialist = { username: 'specialist', role: 'specialist', active: true };
const inactive = { username: 'accountant', role: 'accountant', active: false };

test('accountant is independent from specialist', () => { assert.equal(policy.isAccountant(accountant), true); assert.equal(policy.isSpecialist(accountant), false); assert.equal(policy.isSpecialist(specialist), true); });
test('only owner manages accounts and cannot deactivate owner', () => { assert.equal(policy.canManageAccounts(owner), true); assert.equal(policy.canManageAccounts(accountant), false); assert.equal(policy.canDeactivate(owner, 'accountant'), true); assert.equal(policy.canDeactivate(owner, 'owner'), false); });
test('accountant can read and create finance but not alter existing records', () => { assert.equal(policy.canReadBank(accountant), true); assert.equal(policy.canWriteBank(), false); assert.equal(policy.canCreateFinance(accountant), true); assert.equal(policy.canEditExistingFinance(accountant), false); assert.equal(policy.canRequestCorrection(accountant), true); });
test('inactive account has no access', () => { assert.equal(policy.isAccountant(inactive), false); assert.equal(policy.canReadBank(inactive), false); });
test('correction requests require record, version and reason', () => { assert.equal(policy.validateCorrectionRequest({ recordId: 'f-1', version: 2, reason: 'تصحیح مبلغ', proposal: { amount: 10 } }).ok, true); assert.equal(policy.validateCorrectionRequest({ recordId: 'f-1', version: 0, reason: 'x' }).ok, false); });
test('owner deletion excludes issued, paid and statutory records', () => { assert.equal(policy.canDeleteRecord(owner, {}), true); assert.equal(policy.canDeleteRecord(owner, { issued: true }), false); assert.equal(policy.canDeleteRecord(owner, { paid: true }), false); assert.equal(policy.canDeleteRecord(accountant, {}), false); });
test('approved ten-category taxonomy is stable', () => { assert.equal(policy.INTAKE_CATEGORIES.length, 10); assert.equal(policy.isKnownCategory('01'), true); assert.equal(policy.isKnownCategory('99'), false); });

test('owner label alone does not grant primary-owner access', () => { for (const actor of [{username:'owner',role:'owner',owner:true,active:true},{...owner,email:'other@example.invalid'},{...owner,manager:false},{...owner,laboratory:true},{...owner,active:false},{...owner,username:'other'}]) { assert.equal(policy.canManageAccounts(actor),false); assert.equal(policy.canDeleteRecord(actor,{}),false); } });
test('laboratory context cannot confer accountant privileges',()=>{assert.equal(policy.isAccountant({...accountant,laboratory:true}),false);assert.equal(policy.canReadBank({...accountant,laboratory:true}),false);});
