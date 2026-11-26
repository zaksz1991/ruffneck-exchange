import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routePath = path.join(root, 'app/api/supplier/listings/export/route.ts');
const route = readFileSync(routePath, 'utf8');

assert.ok(route.includes('function asListingRows(data: unknown): Array<Record<string, unknown>>'), 'Export rows must be normalised from unknown data at the Supabase boundary.');
assert.ok(route.includes('if (!Array.isArray(data)) return [];'), 'Row normalisation must reject non-array results.');
assert.ok(route.includes("typeof row === 'object' && row !== null && !Array.isArray(row)"), 'Row normalisation must retain only non-null object records.');
assert.ok(route.includes('asListingRows(firstPage.data)'), 'The first catalogue page must use the safe row normaliser.');
assert.ok(route.includes('asListingRows(page.data)'), 'Subsequent catalogue pages must use the safe row normaliser.');
assert.ok(!route.includes('as Array<Record<string, unknown>>'), 'Direct casts from Supabase GenericStringError[] must not return.');
assert.ok(route.includes(".eq('supplier_application_id', supplier.id)"), 'Export query must remain supplier-scoped.');
console.log('v3.16.1 supplier catalogue export type-repair checks passed.');
