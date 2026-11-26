import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const dashboard = read('components/customer-dashboard.tsx');
const api = read('app/api/customer/saved-listings/route.ts');
const migration = read('supabase/migrations/019_rnx_saved_listing_change_alerts.sql');
const styles = read('app/globals.css');
const packageJson = JSON.parse(read('package.json'));

const [majorVersion, minorVersion] = packageJson.version.split('.').map(Number);
assert.ok(majorVersion > 2 || (majorVersion === 2 && minorVersion >= 7), 'Cumulative package version must retain the v2.7 feature line.');
assert.match(packageJson.scripts.check, /test:rnx-v270/);
assert.match(dashboard, /alerts_enabled: boolean/);
assert.match(dashboard, /Get email alerts/);
assert.match(dashboard, /Turn off email alerts/);
assert.match(dashboard, /updateSavedOfferAlerts\(item\.id, !item\.alerts_enabled\)/);
assert.match(dashboard, /published price and availability changes/);
assert.match(api, /export async function PATCH\(request: NextRequest\)/);
assert.match(api, /isSameOriginRequest\(request\)/);
assert.match(api, /rnx_set_customer_listing_alert/);
assert.match(api, /alerts_enabled: row\.alerts_enabled === true/);
assert.match(migration, /alerts_enabled boolean not null default false/);
assert.match(migration, /customer\.email_verified_at is not null/);
assert.match(migration, /create trigger rnx_saved_listing_change_alert/);
assert.match(migration, /after update of price_type, price, currency, availability_status, status/);
assert.match(migration, /rnx_notifications/);
assert.match(migration, /grant execute on function public\.rnx_set_customer_listing_alert\(uuid, uuid, boolean\) to service_role/);
assert.match(migration, /for update of saved/);
assert.match(migration, /never block a supplier/i);
assert.match(styles, /customer-alert-status/);

console.log('RNX v2.7.0 saved-offer change-alert regression checks passed.');
