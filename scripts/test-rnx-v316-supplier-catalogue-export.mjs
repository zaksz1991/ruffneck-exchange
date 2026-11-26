import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routePath = path.join(root, 'app/api/supplier/listings/export/route.ts');
const dashboardPath = path.join(root, 'components/supplier-dashboard.tsx');
const cssPath = path.join(root, 'app/globals.css');
assert.ok(existsSync(routePath), 'Supplier catalogue export API route is missing.');

const route = readFileSync(routePath, 'utf8');
const dashboard = readFileSync(dashboardPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
for (const required of [
  "getAuthenticatedSupplier()",
  "supplier_application_id', supplier.id",
  "EXPORT_STATUSES = ['all', 'approved', 'pending', 'paused', 'rejected']",
  "MAX_EXPORT_ROWS = 10_000",
  "Content-Type': 'text/csv; charset=utf-8'",
  "Content-Disposition",
  "Cache-Control': 'private, no-store, max-age=0'",
  "X-Content-Type-Options': 'nosniff'",
  `replace(/\"/g, '\"\"')`,
  'uFEFF',
  "range(offset, offset + PAGE_SIZE - 1)",
]) assert.ok(route.includes(required), `Export route is missing required safeguard or behavior: ${required}`);
assert.ok(route.includes('test(raw)') && route.includes('Prefix spreadsheet formula-like values'), 'CSV export must neutralise spreadsheet formula injection.');
assert.ok(!route.includes("select('*'"), 'Export must explicitly select fields rather than exporting all database columns.');
assert.ok(route.includes(".eq('supplier_application_id', supplier.id)"), 'Export must be scoped to the authenticated supplier.');
assert.ok(!route.includes('customer_email') && !route.includes('customer_phone') && !route.includes('image_path'), 'Export must not include customer contact data or private image paths.');
for (const required of [
  'exportCatalogueCsv()',
  '/api/supplier/listings/export?status=',
  'Download catalogue CSV',
  'All catalogue listings',
  'Approved / public listings',
  'Pending RNX review',
  'Paused listings',
  'Rejected listings',
  'reporting and backup snapshot, not an import template',
]) assert.ok(dashboard.includes(required), `Supplier dashboard is missing export UX: ${required}`);
assert.ok(css.includes('.supplier-catalogue-export-form'), 'Responsive supplier export styling is missing.');
assert.ok(!existsSync(path.join(root, 'supabase/migrations/033_rnx_supplier_catalogue_export.sql')), 'CSV export must not add an unnecessary database migration.');
console.log('v3.16.0 supplier catalogue CSV export checks passed.');
