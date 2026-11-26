import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, `file://${process.cwd()}/`), 'utf8');
const migration = read('supabase/migrations/032_rnx_trust_case_response_sla.sql');
const adminListApi = read('app/api/admin/trust-cases/route.ts');
const adminDetailApi = read('app/api/admin/trust-cases/[id]/route.ts');
const adminUi = read('components/admin-trust-console.tsx');
const css = read('app/globals.css');
const packageJson = JSON.parse(read('package.json'));

assert.match(migration, /add column if not exists first_response_sla_minutes integer/i);
assert.match(migration, /add column if not exists first_response_due_at timestamptz/i);
assert.match(migration, /add column if not exists first_response_at timestamptz/i);
assert.match(migration, /when 'critical' then 60/i);
assert.match(migration, /when 'high' then 240/i);
assert.match(migration, /when 'normal' then 480/i);
assert.match(migration, /when 'low' then 1440/i);
assert.match(migration, /sender_role = 'staff' and new\.visibility = 'customer'/i);
assert.match(migration, /first_customer_response_recorded/);
assert.match(migration, /response_sla_met/);
assert.match(migration, /before insert or update of severity/i);
assert.match(migration, /after insert on public\.rnx_trust_case_messages/i);
assert.match(migration, /enable row level security|revoke all on function/i);

assert.match(adminListApi, /first_response_sla_minutes,first_response_due_at,first_response_at/);
assert.match(adminDetailApi, /from\('rnx_trust_cases'\)\.select\('\*,lead:/);
assert.match(adminUi, /function responseSlaState/);
assert.match(adminUi, /sla_overdue/);
assert.match(adminUi, /sla_due_soon/);
assert.match(adminUi, /SLA MONITOR/);
assert.match(adminUi, /first_response_due_at/);
assert.match(adminUi, /first_response_at/);
assert.match(css, /v3\.14\.0 — trust-case first response SLA monitoring/);
assert.equal(packageJson.version, '3.14.1');
assert.equal(packageJson.scripts['test:rnx-v314'], 'node scripts/test-rnx-v314-trust-case-response-sla.mjs');

console.log('RNX v3.14.0 SLA feature regression checks passed under v3.14.1.');
