import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('app/api/sample-intake/researcher/route.ts', 'utf8');

test('a revision conflict is rejected before the response reads any updated record', () => {
  const conflict = route.indexOf('if (!result.meta.changes)');
  const read = route.indexOf('const row = await store.prepare(', conflict);
  assert.ok(conflict >= 0 && read > conflict, 'conflict must precede response record lookup');
  const branch = route.slice(conflict, read);
  assert.match(branch, /return json\(\{ error: "[^"]+" \}, 409\)/);
});

test('idempotent initial saves require the original owner and unchanged first revision', () => {
  const conflict = route.indexOf('if (!result.meta.changes)');
  const read = route.indexOf('const row = await store.prepare(', conflict);
  const branch = route.slice(conflict, read);
  assert.match(branch, /value\.action === "save" && value\.revision === 0/);
  assert.match(branch, /WHERE id=\? AND created_by=\?/);
  assert.match(branch, /existing\.revision === 1/);
  assert.match(branch, /existing\.sheet === JSON\.stringify\(value\.sheet\)/);
});

test('successful updates still return an authorized row', () => {
  assert.match(route, /WHERE id=\? AND \(created_by=\? OR \?=1\)/);
  assert.match(route, /if \(!row\) return json\(\{ error: "برگه در دسترس نیست\." \}, 404\)/);
});
