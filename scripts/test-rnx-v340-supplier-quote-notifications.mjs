import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationPath = join(root, 'supabase/migrations/025_rnx_supplier_quote_notifications.sql');
const apiPath = join(root, 'app/api/supplier/notifications/route.ts');
const dashboardApiPath = join(root, 'app/api/supplier/dashboard/route.ts');
const componentPath = join(root, 'components/supplier-dashboard.tsx');
const cssPath = join(root, 'app/globals.css');
for (const path of [migrationPath, apiPath, dashboardApiPath, componentPath, cssPath]) {
  assert.ok(existsSync(path), `Expected file to exist: ${path}`);
}

const migration = readFileSync(migrationPath, 'utf8');
const api = readFileSync(apiPath, 'utf8');
const dashboardApi = readFileSync(dashboardApiPath, 'utf8');
const component = readFileSync(componentPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

assert.match(migration, /create table if not exists public\.rnx_supplier_notifications/i);
assert.match(migration, /alter table public\.rnx_supplier_notifications enable row level security/i);
assert.match(migration, /revoke all on public\.rnx_supplier_notifications from public, anon, authenticated/i);
assert.match(migration, /grant select, insert, update on public\.rnx_supplier_notifications to service_role/i);
assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/i);
assert.match(migration, /after update of status on public\.rnx_commercial_quotes/i);
for (const status of ['selected', 'not_selected', 'declined', 'expired']) {
  assert.match(migration, new RegExp(`when '${status}' then`), `Expected a notification for ${status}`);
}
assert.match(migration, /new\.status is not distinct from old\.status/);
assert.doesNotMatch(migration, /customer_email|customer_phone|recipient_email|\.email\b|\.phone\b/i, 'Supplier notification rows must not copy customer contact details');

assert.match(api, /getAuthenticatedSupplier\(\)/, 'Notification updates must require an authenticated supplier');
assert.match(api, /isSameOriginRequest\(request\)/, 'Notification updates must be same-origin');
assert.match(api, /eq\('supplier_application_id', supplier\.id\)/, 'Notification updates must be scoped to the current supplier');
assert.match(api, /\.is\('read_at', null\)/, 'Only unread notifications may be changed');
assert.match(api, /mark_all_read/);
assert.match(api, /UUID_PATTERN/);

assert.match(dashboardApi, /getAuthenticatedSupplier\(\)/);
assert.match(dashboardApi, /rnx_supplier_notifications/);
assert.match(dashboardApi, /eq\('supplier_application_id', supplier\.id\)/);
assert.match(dashboardApi, /unreadNotificationCount/);
assert.match(dashboardApi, /select\('id,notification_type,title,message,related_quote_id,read_at,created_at'\)/, 'Supplier notification API payload must not select customer contact details');
assert.match(component, /COMMERCIAL QUOTATION UPDATES/i);
assert.match(component, /markSupplierNotificationRead/);
assert.match(component, /Open opportunity inbox/);
assert.match(component, /id="supplier-opportunities"/);
assert.match(css, /\.supplier-notifications-panel/);

console.log('RNX v3.4.0 supplier commercial quotation notification regression checks passed.');
