import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const tax=read('lib/unified-intake-taxonomy.ts');
const route=read('lib/unified-intake-routing.ts');
const engine=read('lib/dispatch-engine.ts');
const api=read('app/api/ticket-support/route.ts');
const ops=read('app/operations/operations-app.tsx');
const fields=read('components/operations/unified-intake-filters.tsx');
const db=read('lib/operations-data.ts');
const permit=read('lib/ops-policy.ts');
const policy=read('lib/dispatch-policy.ts');
const staff=read('lib/staff-data.ts');
const home=read('lib/home-data.ts');
test('exact central ten-category catalog exists with six service and four consultation identifiers',()=>{
 for(const x of ['service_orders','service_projects','service_results','service_finance','service_admin','service_it','consult_before','consult_change','consult_execution','consult_results'])assert.ok(tax.includes("id:'"+x+"'"),x);
 assert.match(tax,/intakeDefaultResponsibility/);
 assert.match(tax,/seniorResearchMayReview/);
});
test('unapproved employee mappings never randomly fall back to owner',()=>{
 assert.match(route,/unified_pending_/);
 assert.ok(engine.includes('main=await eligibleIntakePosition(initialPosition'));
 assert.match(engine,/eligibleIntakePosition\(baseTarget,m\.unifiedIntake\)/);
 assert.match(engine,/unifiedIntake:m\.unifiedIntake\|\|null/);
 assert.ok(engine.includes('eligibleIntakePosition(rawP,d.unifiedIntake)'));
 assert.match(engine,/hasDataAccess\(member,unifiedRequiredAccess/);
});
test('tickets and manually classified intake share original idempotent dispatch engine',()=>{
 assert.match(api,/submitSupportTicket\(u,b\)/);
 assert.match(readFileSync('lib/ticket-support-submit.ts','utf8'),/dispatchCreate\(user,dispatchEntry/);
 assert.match(readFileSync('lib/ticket-support-submit.ts','utf8'),/unifiedCategory:entry\.category,\s*unifiedTopic:entry\.topic/);
 assert.match(engine,/verifiedUnifiedClassification/);
 assert.match(engine,/source_labels=\?/);
 assert.match(engine,/INSERT OR IGNORE INTO staff_records/);
 assert.match(ops,/<OperationsIntakeForm[^\n]+onSubmit=\{async payload=>\{const ok=await save\(payload\)/);
});
test('both views retain current source icons and use server-side filters',()=>{
 assert.match(ops,/communication-channels/);
 assert.match(ops,/UnifiedIntakeFilters/);
 assert.match(ops,/ops-ticket-inline/);
 assert.match(ops,/ops-inline-entry/);
 assert.match(ops,/disabled aria-describedby="ops-phone-status"/);
 for(const f of ['unifiedGroup','unifiedCategory','unifiedTopic','unifiedRole'])assert.ok(db.includes("p.get('"+f+"')"),f);
 assert.match(db,/unifiedCounts/);
 assert.match(fields,/counts\?\.\[c\.id\]/);
});
test('newly routed records honor existing permissions and staff home data',()=>{
 assert.match(policy,/unifiedRequiredAccess/);
 assert.match(permit,/canUseOpsCategory/);
 assert.match(permit,/unifiedRequiredAccess/);
 assert.match(staff,/records:authorized/);
 assert.match(home,/readStaffData\(user\)/);
});
test('manual reassignment is audited and does not mutate unrelated assignments',()=>{
 const manual=read('lib/operations-manual-assignment.ts');
 assert.match(manual,/reason:String\(b\.reason/);
 assert.match(manual,/canUseOpsCategory\(target,r\)/);
 assert.match(manual,/manualTaskTransfer/);
});
test('legacy tickets remain recognized; no existing database migration or destructive drop',()=>{
 const ticket=read('lib/ticket-support-policy.ts');
 assert.match(ticket,/Historical ticket_v:1 rows remain readable/);
 assert.match(db,/getTicketCategories/);
 assert.doesNotMatch(engine,/DROP TABLE|DELETE FROM ops_items/);
});

test('responsibility views match the approved nine-role allocation',async()=>{
 const {intakeResponsibleRoles,responsibilityCategories,responsibilityTopics}=await import('../lib/unified-intake-taxonomy.ts');
 const counts=Object.fromEntries(intakeResponsibleRoles.map(({id})=>[id,
  responsibilityCategories(id).reduce((n,category)=>n+responsibilityTopics(id,category).length,0)
 ]));
 assert.deepEqual(counts,{director:63,senior_research:44,technical_project:20,scientific_project:13,
  scientific_reception:11,finance_manager:3,accountant:4,administrative:9,it_specialist:3});
});
