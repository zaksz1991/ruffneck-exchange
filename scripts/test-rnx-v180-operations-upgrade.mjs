import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const action = await readFile(new URL('../app/api/admin/actions/route.ts', import.meta.url), 'utf8');
const marketplace = await readFile(new URL('../app/marketplace/page.tsx', import.meta.url), 'utf8');
const how = await readFile(new URL('../app/how-it-works/page.tsx', import.meta.url), 'utf8');
const requestPage = await readFile(new URL('../app/request/page.tsx', import.meta.url), 'utf8');
const requestForm = await readFile(new URL('../components/request-form.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.8.0');
assert.match(action, /SUPPLIER_EMAIL_CONFIRMATION_REQUIRED/);
assert.match(action, /Supplier email must be confirmed before approval/i);
assert.match(action, /RNX_SCHEMA_MISMATCH/);
assert.match(action, /RNX_DATABASE_PERMISSION/);
assert.match(action, /No status was changed/);
assert.match(action, /isSameOriginRequest/);
assert.match(action, /hasPermission\(actor\.role, 'operations:write'\)/);
assert.match(action, /supplier\.status !== 'approved'/);
assert.match(marketplace, /SOURCING DESK/);
assert.match(marketplace, /Submit a free sourcing request/);
assert.match(marketplace, /name="category"/);
assert.match(how, /automated payment-gateway checkout is not active/i);
assert.match(how, /explicit permission/i);
assert.match(requestPage, /initialCategory/);
assert.match(requestPage, /new Set<string>\(site\.states\)\.has\(requestedState\)/);
assert.doesNotMatch(requestPage, /site\.states\.includes\(requestedState\)/);
assert.match(requestForm, /defaultValue=\{initialCategory\}/);
assert.match(requestForm, /defaultValue=\{initialState\}/);
assert.doesNotMatch(how, /dashboards and automated notifications remain manual or not yet implemented/i);

console.log('RNX v1.8.0 focused operations tests: 20 assertions passed.');
