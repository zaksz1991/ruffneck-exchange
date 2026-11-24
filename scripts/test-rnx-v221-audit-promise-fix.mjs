import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const route = await read('app/api/supplier/listings/[id]/image/route.ts');

assert.equal(pkg.version, '2.2.1');
assert.match(route, /try\s*\{\s*const \{ error: auditError \} = await db\.from\('rnx_admin_audit_log'\)\.insert\(/s);
assert.match(route, /if \(auditError\) console\.error\('\[RNX listing image audit\]', auditError\.message\)/);
assert.match(route, /catch \(auditError\)/);
assert.doesNotMatch(route, /\.then\(\(\{ error \}\).*?\)\s*\.catch\(/s);
assert.match(route, /return NextResponse\.json\(\{\s*ok: true,/s);

console.log('RNX v2.2.1 PromiseLike audit fix: PASS');
console.log('Checks: no unsupported PromiseLike.catch(), awaited audit insert, best-effort audit failure handling and unchanged successful upload response.');
