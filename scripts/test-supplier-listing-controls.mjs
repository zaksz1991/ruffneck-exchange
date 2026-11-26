import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const route = readFileSync('app/api/supplier/listings/[id]/route.ts', 'utf8');
const dashboard = readFileSync('components/supplier-dashboard.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/002_rnx_catalogue.sql', 'utf8');

assert.match(route, /isSameOriginRequest\(request\)/);
assert.match(route, /getAuthenticatedSupplier\(\)/);
assert.match(route, /eq\('supplier_application_id', supplier\.id\)/);
assert.match(route, /listing\.status === 'approved'/);
assert.match(route, /listing\.status === 'paused'/);
assert.match(route, /status: nextStatus/);
assert.match(route, /'paused'/);
assert.match(route, /'pending'/);
assert.match(dashboard, /changeListingStatus\(listing\.id, 'pause'\)/);
assert.match(dashboard, /changeListingStatus\(listing\.id, 'reactivate'\)/);
assert.match(migration, /'pending','approved','rejected','paused'/);
console.log('RNX supplier listing controls contract: PASS');
