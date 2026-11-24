import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const dashboard = read('components/customer-dashboard.tsx');
const styles = read('app/globals.css');
const packageJson = JSON.parse(read('package.json'));

assert.match(dashboard, /const MAX_COMPARE_LISTINGS = 3/);
assert.match(dashboard, /Select two or three offers/);
assert.match(dashboard, /compareIds/);
assert.match(dashboard, /toggleCompare\(item\.id\)/);
assert.match(dashboard, /aria-pressed=\{selected\}/);
assert.match(dashboard, /disabled=\{!selected && atLimit\}/);
assert.match(dashboard, /Offer comparison/);
assert.match(dashboard, /Published price/);
assert.match(dashboard, /Supplier reports available/);
assert.match(dashboard, /Prices remain in their stated currencies and are not converted/);
assert.ok(dashboard.includes('setCompareIds((items) => items.filter((id) => id !== listingId))'));
assert.ok(dashboard.includes('setCompareIds((current) => current.filter((id) => nextSavedIds.has(id)))'));
assert.match(styles, /customer-comparison-table/);
assert.match(styles, /@media\(max-width:720px\).*customer-comparison-panel/s);
assert.equal(packageJson.version, '2.6.0');
assert.match(packageJson.scripts.check, /test:rnx-v260/);

console.log('RNX v2.6.0 saved-offer comparison regression checks passed.');
