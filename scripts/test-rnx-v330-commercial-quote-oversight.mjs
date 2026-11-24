import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const apiPath = join(root, 'app/api/admin/quotes/route.ts');
const pagePath = join(root, 'app/admin/quotes/page.tsx');
const componentPath = join(root, 'components/admin-commercial-quote-console.tsx');
const adminHomePath = join(root, 'app/admin/page.tsx');
const cssPath = join(root, 'app/globals.css');

for (const path of [apiPath, pagePath, componentPath, adminHomePath, cssPath]) {
  assert.ok(existsSync(path), `Expected file to exist: ${path}`);
}

const api = readFileSync(apiPath, 'utf8');
const page = readFileSync(pagePath, 'utf8');
const component = readFileSync(componentPath, 'utf8');
const adminHome = readFileSync(adminHomePath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

assert.match(api, /getAdminSession\(\)/, 'API must require an admin session');
assert.match(api, /hasPermission\(actor\.role, 'operations:read'\)/, 'API must enforce operations read permission');
assert.match(api, /MAX_RECORDS\s*=\s*250/, 'API must cap quotation records');
assert.match(api, /rnx_commercial_quotes/, 'API must read the commercial quotation table');
assert.match(api, /rnx_commercial_quote_events/, 'API must include quote event history');
assert.match(api, /rnx_supplier_applications/, 'API must map supplier identity');
assert.match(api, /rnx_leads/, 'API must map request category and location');
assert.doesNotMatch(api, /customer_email|customer_phone|\.select\([^\n]*(?:email|phone)/i, 'API must not return customer contact information');
assert.match(page, /hasPermission\(session\.role, 'operations:read'\)/, 'Page must enforce operations read permission');
assert.match(component, /Export visible CSV/, 'Console must support CSV export');
assert.match(component, /const safe = \/\^\[\\s\]\*\[=\+\\-@\]\//, 'CSV export must neutralise spreadsheet formula injection');
assert.match(component, /Recorded history/, 'Console must expose quote event history');
assert.match(component, /supplier proposals, not RNX revenue/, 'Console must distinguish proposals from RNX revenue');
assert.match(component, /STATUS_LABELS/, 'Quote status display must be present');
assert.match(adminHome, /href="\/admin\/quotes"/, 'Admin home must link to commercial quotation oversight');
assert.match(css, /\.admin-commercial-quotes/, 'Commercial oversight styling must be present');
assert.ok(!existsSync(join(root, 'supabase/migrations/025_rnx_commercial_quote_oversight.sql')), 'Read-only oversight must not add an unnecessary database migration');

console.log('RNX v3.3.0 commercial quote oversight regression checks passed.');
