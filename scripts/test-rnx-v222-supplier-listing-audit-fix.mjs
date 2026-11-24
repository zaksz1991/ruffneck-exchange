import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const route = await read('app/api/supplier/listings/[id]/route.ts');

assert.equal(pkg.version, '2.2.2');
assert.equal((route.match(/\.from\('rnx_admin_audit_log'\)\.insert\(/g) || []).length, 2, 'both supplier audit writes must remain present');
assert.equal((route.match(/const \{ error: auditError \} = await db\.from\('rnx_admin_audit_log'\)\.insert\(/g) || []).length, 2, 'both audit writes must await the Supabase thenable');
assert.equal((route.match(/catch \(auditError\)/g) || []).length, 2, 'both audit writes must safely catch rejected thenables');
assert.doesNotMatch(route, /\.then\([\s\S]{0,500}?\)\.catch\(/, 'Supabase PromiseLike must not use native Promise.catch chaining');
assert.match(route, /supplier_listing_edited/);
assert.match(route, /supplier_listing_paused/);
assert.match(route, /supplier_listing_resubmitted/);
assert.match(route, /Listing changes saved and submitted for RNX review/);
assert.match(route, /Listing paused and removed from public marketplace results/);

console.log('RNX v2.2.2 supplier listing PromiseLike audit regression: PASS');
console.log('Checks: both audit writes retained, awaited, isolated as best-effort operations, with no unsupported PromiseLike.catch() chain.');
