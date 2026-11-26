import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, `file://${process.cwd()}/`), 'utf8');
const migration = read('supabase/migrations/031_rnx_trust_case_resolution_appeals.sql');
const customerRoute = read('app/api/track/[token]/cases/[caseId]/appeal/route.ts');
const adminRoute = read('app/api/admin/trust-cases/[id]/appeal/route.ts');
const trackApi = read('app/api/track/[token]/route.ts');
const adminDetailApi = read('app/api/admin/trust-cases/[id]/route.ts');
const adminListApi = read('app/api/admin/trust-cases/route.ts');
const customerUi = read('components/tracking-page.tsx');
const adminUi = read('components/admin-trust-console.tsx');
const css = read('app/globals.css');

assert.match(migration, /add column if not exists resolution_published_at timestamptz/i);
assert.match(migration, /coalesce\(resolved_at, closed_at, updated_at, created_at\)/i);
assert.match(migration, /create table if not exists public\.rnx_trust_case_appeals/i);
assert.match(migration, /trust_case_id uuid not null unique/i);
assert.match(migration, /status in \('submitted','accepted','not_upheld'\)/i);
assert.match(migration, /customer_reason text not null/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on public\.rnx_trust_case_appeals from public, anon, authenticated/i);
assert.match(migration, /grant all on public\.rnx_trust_case_appeals to service_role/i);
assert.match(migration, /now\(\) > v_case\.resolution_published_at \+ interval '14 days'/i);
assert.match(migration, /TRUST_CASE_APPEAL_EXISTS/);
assert.match(migration, /TRUST_CASE_APPEAL_WINDOW_EXPIRED/);
assert.match(migration, /rnx_submit_trust_case_appeal\(uuid, text\)/i);
assert.match(migration, /rnx_review_trust_case_appeal\(uuid, uuid, text, text, text\)/i);
assert.match(migration, /security definer/i);
assert.match(migration, /appeal_submitted/);
assert.match(migration, /appeal_reviewed/);
assert.match(migration, /set status = 'under_review'/i);
assert.match(migration, /revoke all on function public\.rnx_submit_trust_case_appeal/i);
assert.match(migration, /grant execute on function public\.rnx_review_trust_case_appeal/i);

assert.match(customerRoute, /isSameOriginRequest/);
assert.match(customerRoute, /hashTrackingToken/);
assert.match(customerRoute, /eq\('tracking_token_hash', hashTrackingToken\(token\)\)/);
assert.match(customerRoute, /eq\('lead_id', lead\.id\)/);
assert.match(customerRoute, /rnx_submit_trust_case_appeal/);
assert.match(customerRoute, /TRUST_CASE_APPEAL_WINDOW_EXPIRED/);
assert.match(customerRoute, /queueNotification/);

assert.match(adminRoute, /hasPermission\(actor\.role, 'trust:write'\)/);
assert.match(adminRoute, /rnx_review_trust_case_appeal/);
assert.match(adminRoute, /decision: z\.enum\(\['accepted', 'not_upheld'\]\)/);
assert.match(adminRoute, /queueNotification/);
assert.match(adminRoute, /recordStaffActivity/);

assert.match(trackApi, /resolution_published_at/);
assert.match(trackApi, /rnx_trust_case_appeals/);
assert.match(trackApi, /caseAppealAvailable/);
assert.match(adminDetailApi, /rnx_trust_case_appeals/);
assert.match(adminListApi, /appeal_status/);

assert.match(customerUi, /Request resolution review/);
assert.match(customerUi, /14-day resolution review window/);
assert.match(customerUi, /submitAppeal/);
assert.match(customerUi, /trustCase\.appeal \|\| trustCase\.status === 'resolved'/);
assert.match(customerUi, /staff_response/);
assert.match(adminUi, /Appeals awaiting review/);
assert.match(adminUi, /Accept and reopen case/);
assert.match(adminUi, /Do not uphold appeal/);
assert.match(adminUi, /CUSTOMER APPEAL/);
assert.match(css, /v3\.13\.0 — customer resolution review and appeal workflow/);

console.log('RNX v3.13.0 trust-case resolution appeal regression checks passed.');
