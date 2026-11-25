import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../components/commercial-quote-revision-history.tsx', import.meta.url), 'utf8');
const customer = readFileSync(new URL('../components/customer-dashboard.tsx', import.meta.url), 'utf8');
const supplier = readFileSync(new URL('../components/supplier-dashboard.tsx', import.meta.url), 'utf8');

assert.match(component, /revision_of_quote_id/, 'revision history must use the persisted parent/child link');
assert.match(component, /Quotation revision history/, 'the component must identify the version-history panel');
assert.match(component, /Changes from the previous version/, 'each revised version must have a before/after comparison');
assert.match(component, /scope_description/, 'scope changes must be compared');
assert.match(component, /delivery_terms/, 'delivery terms must be compared');
assert.match(component, /estimated_fulfilment/, 'fulfilment estimates must be compared');
assert.match(component, /valid_until/, 'quote validity changes must be compared');
assert.match(component, /previous\.currency !== current\.currency/, 'currency changes must not be treated as directly comparable amounts');
assert.match(component, /does not convert the amounts or rank them by value/, 'currency differences must be disclosed');
assert.match(component, /revision_request_note/, "the customer revision instruction must remain visible");
assert.match(component, /visited\.has\(current\.id\)/, 'malformed revision cycles must not cause an endless traversal');
assert.match(customer, /CommercialQuoteRevisionHistory quotes=\{offer\.quotes\} audience="customer"/, 'the customer dashboard must show revision history');
assert.match(supplier, /CommercialQuoteRevisionHistory quotes=\{offer\.quotes\} audience="supplier"/, 'the supplier dashboard must show revision history');
assert.doesNotMatch(component, /binding contract|payment accepted|order confirmed/i, 'revision history must not imply contract acceptance or payment');

const migrationFiles = ['024_rnx_commercial_quotes.sql', '025_rnx_supplier_quote_notifications.sql', '026_rnx_commercial_quote_conversations.sql', '027_rnx_commercial_quote_attachments.sql', '028_rnx_commercial_quote_revision_requests.sql'];
for (const file of migrationFiles) {
  const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
  assert.ok(sql.length > 0, `${file} must remain present in the cumulative release`);
}

console.log('v3.10.0 quotation revision-history regression checks passed.');
