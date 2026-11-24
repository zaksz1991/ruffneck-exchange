import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/021_rnx_customer_request_activity_timeline.sql');
const api = read('app/api/customer/requests/route.ts');
const dashboard = read('components/customer-dashboard.tsx');
const styles = read('app/globals.css');
const packageJson = JSON.parse(read('package.json'));
const readme = read('README.md');

assert.equal(packageJson.version, '3.0.0');
assert.match(packageJson.scripts.check, /test:rnx-v290/);
assert.match(migration, /create table if not exists public\.rnx_customer_request_activity/);
assert.match(migration, /alter table public\.rnx_customer_request_activity enable row level security/);
assert.match(migration, /revoke all on public\.rnx_customer_request_activity from public, anon, authenticated/);
assert.match(migration, /security definer/);
assert.match(migration, /set search_path = public, pg_temp/);
assert.match(migration, /after insert or update on public\.rnx_leads/);
assert.match(migration, /new\.status is distinct from old\.status/);
assert.match(migration, /new\.contact_release_status is distinct from old\.contact_release_status/);
assert.match(migration, /delete from public\.rnx_customer_request_activity/);
assert.match(migration, /old\.customer_id is distinct from new\.customer_id/);
assert.match(migration, /not exists/);
assert.doesNotMatch(migration, /availability_status|rnx_customer_saved_listings/);
assert.match(api, /rnx_customer_request_activity/);
assert.match(api, /eq\('customer_id', customerId\)/);
assert.match(api, /activity: activity\.filter/);
assert.match(dashboard, /type RequestActivity =/);
assert.match(dashboard, /Request progress/);
assert.match(dashboard, /requestActivityTitle/);
assert.match(dashboard, /requestActivityDetail/);
assert.match(dashboard, /Introduction permission updated/);
assert.match(styles, /customer-request-activity-list/);
assert.match(styles, /@media\(max-width:620px\).*customer-request-activity/s);
assert.match(readme, /v2\.9\.0 — customer request progress timeline/);

console.log('RNX v2.9.0 customer request timeline regression checks passed.');
