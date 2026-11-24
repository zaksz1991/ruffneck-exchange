import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const listingRoute = await read('app/api/supplier/listings/[id]/route.ts');
const dashboardRoute = await read('app/api/supplier/dashboard/route.ts');
const dashboardUi = await read('components/supplier-dashboard.tsx');
const css = await read('app/globals.css');

const currentVersion = pkg.version.split('.').map(Number);
assert.ok(currentVersion[0] > 2 || (currentVersion[0] === 2 && currentVersion[1] > 2) || (currentVersion[0] === 2 && currentVersion[1] === 2 && currentVersion[2] >= 2), 'the cumulative release must be v2.2.2 or later');
assert.match(pkg.scripts['test:rnx-v210'], /test-rnx-v210-supplier-listing-edit/);
assert.match(pkg.scripts.check, /test:rnx-v210/);
assert.match(listingRoute, /getAuthenticatedSupplier\(\)/);
assert.match(listingRoute, /\.eq\('supplier_application_id', supplier\.id\)/);
assert.match(listingRoute, /action: z\.literal\('update'\)/);
assert.match(listingRoute, /listing\.status === 'approved'/);
assert.match(listingRoute, /\['pending', 'rejected', 'paused'\]/);
assert.match(listingRoute, /status: 'pending'/);
assert.match(listingRoute, /price_type === 'enquiry' \? null : Number\(values\.price\)/);
assert.match(listingRoute, /\.eq\('status', listing\.status\)/);
assert.match(listingRoute, /\.select\('id,title,status,updated_at'\)/);
assert.match(listingRoute, /supplier_listing_edited/);
assert.match(listingRoute, /supplier_listing_paused/);
assert.match(listingRoute, /rnx_admin_audit_log/);
assert.match(dashboardRoute, /description,state,city,price_type,price,currency,keywords,status,image_path,created_at,updated_at/);
assert.match(dashboardUi, /setEditingListing/);
assert.match(dashboardUi, /submitListing\(event, editingListing\.id\)/);
assert.match(dashboardUi, /action: 'update'/);
assert.match(dashboardUi, /Save changes & submit for review/);
assert.match(dashboardUi, /Correct & resubmit/);
assert.match(dashboardUi, /Pause to edit/);
assert.match(css, /supplier-editing-banner/);

console.log('RNX v2.1.0 supplier catalogue editing contract: PASS');
console.log('Checks: supplier ownership, status restrictions, safe re-review, field validation, price consistency and supplier editing UI.');
