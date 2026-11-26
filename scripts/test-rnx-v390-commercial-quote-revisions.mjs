import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migrationPath = 'supabase/migrations/028_rnx_commercial_quote_revision_requests.sql';
assert.equal(existsSync(new URL(`../${migrationPath}`, import.meta.url)), true, 'migration 028 must exist');
const migration = read(migrationPath);
assert.match(migration, /revision_requested/, 'the quote lifecycle must include a revision-requested state');
assert.match(migration, /revision_of_quote_id/, 'revised proposals must point to the original quote');
assert.match(migration, /revision_request_note/, "the customer's requested changes must be retained");
assert.match(migration, /rnx_request_commercial_quote_revision/, 'customers need a database-validated revision request RPC');
assert.match(migration, /rnx_submit_commercial_quote_revision/, 'suppliers need a database-validated revised quote submission RPC');
assert.match(migration, /supplier_accepted_at is not null/, 'revision request must preserve supplier acceptance gate');
assert.match(migration, /payment_status = 'paid'/, 'revision request must preserve RNX payment verification gate');
assert.match(migration, /payment_verified_at is not null/, 'revision request must require verified payment timestamp');
assert.match(migration, /customer_approved_at is not null/, 'revision request must preserve customer approval gate');
assert.match(migration, /contact_released_at is not null/, 'revision request must preserve contact-release gate');
assert.match(migration, /rnx_supplier_notifications/, 'supplier must receive an in-app revision notification');
assert.match(migration, /commercial_quote_revision_requested/, 'supplier notification type must be constrained and explicit');
assert.match(migration, /commercial_quote_message/, 'revision migration must preserve the supplier conversation notification type added in migration 026');
assert.match(migration, /revision_submitted/, 'the new quote must receive a revision-submitted event');
assert.match(migration, /one_revision_per_parent/, 'a revision request must not create duplicate child versions');
assert.match(migration, /revoke all on function public\.rnx_request_commercial_quote_revision\(uuid,uuid,text\) from public, anon, authenticated/, 'revision RPC must not be directly executable by browser roles');
assert.match(migration, /grant execute on function public\.rnx_request_commercial_quote_revision\(uuid,uuid,text\) to service_role/, 'revision RPC must be available to the authenticated server client');
assert.match(migration, /grant execute on function public\.rnx_submit_commercial_quote_revision/, 'supplier revision RPC must be granted only to the server role');

const customerApi = read('app/api/customer/quotes/[id]/route.ts');
assert.match(customerApi, /request_revision/, 'customer API must accept revision requests');
assert.match(customerApi, /rnx_request_commercial_quote_revision/, 'customer API must call the protected revision RPC');
assert.match(customerApi, /revision_note/, 'customer API must require a revision explanation');
assert.match(customerApi, /isSameOriginRequest/, 'customer API must enforce same-origin requests');
assert.match(customerApi, /currentCustomerId\(\)/, 'customer API must require a signed customer session');

const supplierApi = read('app/api/supplier/quotes/route.ts');
assert.match(supplierApi, /revision_of_quote_id/, 'supplier API must accept a parent quote reference');
assert.match(supplierApi, /rnx_submit_commercial_quote_revision/, 'supplier API must use the revision-specific database RPC');
assert.match(supplierApi, /getAuthenticatedSupplier\(\)/, 'supplier API must require the supplier session');

const customerDashboard = read('components/customer-dashboard.tsx');
assert.match(customerDashboard, /Request changes/, 'customers must have a revision request action');
assert.match(customerDashboard, /requestCommercialQuoteRevision/, 'customers must submit the revision note');
assert.match(customerDashboard, /revision_requested/, 'customers must see the revision-request state');
assert.match(customerDashboard, /revision_of_quote_id/, 'customers must see the revised quote lineage');

const supplierDashboard = read('components/supplier-dashboard.tsx');
assert.match(supplierDashboard, /Respond to the customer's revision request/, 'suppliers must see the outstanding request');
assert.match(supplierDashboard, /revision_request_note/, 'suppliers must see the requested changes');
assert.match(supplierDashboard, /revision_of_quote_id/, 'supplier-submitted revisions must identify the previous quote');
assert.match(supplierDashboard, /Send revised quotation/, 'suppliers must be able to submit a revised quotation');

const adminApi = read('app/api/admin/quotes/route.ts');
const adminUi = read('components/admin-commercial-quote-console.tsx');
assert.match(adminApi, /revisionRequested/, 'operations summary must count pending revision requests');
assert.match(adminApi, /revision_request_note/, 'operations API must load revision request notes');
assert.match(adminUi, /Customer requested revision/, 'operations must filter revision-requested quotes');
assert.match(adminUi, /revision_submitted/, 'operations event history must label revised submissions');

const customerOffersApi = read('app/api/customer/offers/route.ts');
const supplierDashboardApi = read('app/api/supplier/dashboard/route.ts');
assert.match(customerOffersApi, /revision_request_note/, 'customer quote data must include revision notes');
assert.match(supplierDashboardApi, /revision_request_note/, 'supplier quote data must include revision notes');

console.log('v3.9.0 commercial quotation revision regression checks passed.');
