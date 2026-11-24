import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/018_rnx_customer_saved_listings.sql');
const route = read('app/api/customer/saved-listings/route.ts');
const button = read('components/save-listing-button.tsx');
const detail = read('app/marketplace/listing/[slug]/page.tsx');
const dashboard = read('components/customer-dashboard.tsx');
const css = read('app/globals.css');

assert.match(migration, /create table if not exists public\.rnx_customer_saved_listings/i);
assert.match(migration, /unique \(customer_id, listing_id\)/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all .* from public, anon, authenticated/i);
assert.match(migration, /l\.status = 'approved'/i);
assert.match(migration, /s\.status = 'approved'/i);

assert.match(route, /currentCustomerId\(\)/);
assert.match(route, /\.eq\('customer_id', customerId\)/);
assert.match(route, /\.eq\('listing\.status', 'approved'\)/);
assert.match(route, /\.eq\('listing\.supplier\.status', 'approved'\)/);
assert.match(route, /\.eq\('customer_id', customerId\)\s*\.eq\('listing_id', listingId\)/);
assert.match(route, /23505/);
assert.match(route, /signedListingImageUrl/);

assert.match(button, /Sign in to save this offer/);
assert.match(button, /method: saved \? 'DELETE' : 'POST'/);
assert.match(detail, /SaveListingButton/);
assert.match(detail, /currentCustomerId/);
assert.match(dashboard, /Saved offers/);
assert.match(dashboard, /removeSaved\(listingId:string\)/);
assert.match(css, /customer-saved-grid/);

console.log('RNX v2.5.0 customer saved listings regression checks passed.');
