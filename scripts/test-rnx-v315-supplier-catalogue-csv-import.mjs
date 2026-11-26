import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routePath = path.join(root, 'app/api/supplier/listings/import/route.ts');
const dashboardPath = path.join(root, 'components/supplier-dashboard.tsx');
const templatePath = path.join(root, 'public/templates/rnx-catalogue-import-template.csv');
assert.ok(existsSync(routePath), 'Supplier CSV import API route is missing.');
assert.ok(existsSync(templatePath), 'Supplier CSV import template is missing.');

const route = readFileSync(routePath, 'utf8');
const dashboard = readFileSync(dashboardPath, 'utf8');
const template = readFileSync(templatePath, 'utf8').trim();

for (const required of [
  "isSameOriginRequest(request)",
  'getAuthenticatedSupplier()',
  'MAX_CSV_CHARS = 250_000',
  'MAX_IMPORT_ROWS = 25',
  "Buffer.byteLength(csv, 'utf8') > MAX_CSV_CHARS",
  "z.enum(['product', 'service', 'wholesale', 'rental'])",
  "z.enum(['enquiry', 'fixed', 'from'])",
  'site.states.find',
  'rnx_membership_subscriptions',
  'listing_limit',
  "in('status', ['pending', 'approved', 'paused'])",
  "status: 'pending'",
  "currency: 'NGN'",
  'No listings were imported because the CSV contains invalid rows.',
  "db.from('rnx_listings').insert(inserts)",
]) assert.ok(route.includes(required), `Import route is missing expected safeguard or workflow: ${required}`);

assert.ok(route.includes('if (inQuotes)') && route.includes("text[index + 1] === '\"'"), 'CSV parser must support quoted commas and escaped double quotes.');
assert.ok(route.indexOf('if (rowErrors.length) return') < route.indexOf("db.from('rnx_listings').insert(inserts)"), 'All rows must validate before any insert is attempted.');
for (const required of [
  "fetch('/api/supplier/listings/import'",
  'file.size > 250 * 1024',
  "accept=\".csv,text/csv\"",
  '/templates/rnx-catalogue-import-template.csv',
  'up to 25 listings',
  'submitted for RNX moderation',
  'catalogueImportSummary',
]) assert.ok(dashboard.includes(required), `Supplier dashboard is missing CSV import UX: ${required}`);

const expectedHeader = 'title,listing_type,category,description,state,city,price_type,price,keywords';
assert.ok(template.startsWith(expectedHeader), 'CSV template header does not match the import API.');
assert.ok(template.split('\n').length >= 2, 'CSV template must include one example listing row.');
assert.ok(!existsSync(path.join(root, 'supabase/migrations/033_rnx_catalogue_csv_import.sql')), 'This release should not add a database migration.');

console.log('v3.15.0 supplier catalogue CSV import checks passed.');
