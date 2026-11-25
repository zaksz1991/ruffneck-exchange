import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const requiredFiles = [
  'lib/commercial-quote-document.ts',
  'components/commercial-quote-document.tsx',
  'components/print-quote-document-button.tsx',
  'app/customer/quotes/[id]/document/page.tsx',
  'app/supplier/quotes/[id]/document/page.tsx',
];
for (const path of requiredFiles) assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`);

const loader = read('lib/commercial-quote-document.ts');
assert.match(loader, /eq\(ownerColumn, participantId\)/, 'the quote must be scoped to its recorded participant');
assert.match(loader, /rpc\('rnx_expire_commercial_quotes'\)/, 'quotation expiry must be refreshed before rendering the document');
assert.match(loader, /payment_status === 'paid'/, 'the introduction payment must be verified');
assert.match(loader, /payment_verified_at/, 'the payment verification timestamp must be present');
assert.match(loader, /supplier_accepted_at/, 'supplier acceptance must be rechecked');
assert.match(loader, /customer_approved_at/, 'customer approval must be rechecked');
assert.match(loader, /contact_released_at/, 'contact release must be rechecked');
assert.match(loader, /portal_enabled', true/, 'supplier portal must be enabled');
assert.match(loader, /status', 'active'/, 'customer account must be active');
assert.doesNotMatch(loader, /select\([^\n]*(?:phone|email|password_hash)/i, 'the document loader must not query customer or supplier contact credentials');

const customerPage = read('app/customer/quotes/[id]/document/page.tsx');
const supplierPage = read('app/supplier/quotes/[id]/document/page.tsx');
assert.match(customerPage, /currentCustomerId\(\)/, 'customer document page must require a customer session');
assert.match(customerPage, /loadCommercialQuoteDocument\(id, 'customer', customerId\)/, 'customer document must use customer ownership');
assert.match(supplierPage, /currentSupplierId\(\)/, 'supplier document page must require a supplier session');
assert.match(supplierPage, /loadCommercialQuoteDocument\(id, 'supplier', supplierId\)/, 'supplier document must use supplier ownership');
assert.match(customerPage, /robots: \{ index: false, follow: false, noarchive: true \}/, 'customer quote documents must not be indexed or archived');
assert.match(supplierPage, /robots: \{ index: false, follow: false, noarchive: true \}/, 'supplier quote documents must not be indexed or archived');

const document = read('components/commercial-quote-document.tsx');
assert.match(document, /quote_reference/, 'quote reference must appear');
assert.match(document, /scope_description/, 'scope must appear');
assert.match(document, /delivery_terms/, 'delivery and payment terms must appear');
assert.match(document, /valid_until/, 'validity must appear');
assert.match(document, /This document is not an invoice, payment receipt, purchase order, contract/, 'the document must not misrepresent its legal/commercial effect');
assert.match(document, /Save as PDF/, 'the print instructions must explain browser PDF export');

const printButton = read('components/print-quote-document-button.tsx');
assert.match(printButton, /window\.print\(\)/, 'the print control must invoke the browser print dialog');
const css = read('app/globals.css');
assert.match(css, /@media print\s*\{/, 'print-specific styling must exist');
assert.match(css, /\.site-header,.site-footer[^\n]*display:none!important/, 'site navigation must be hidden from printed documents');

const customerDashboard = read('components/customer-dashboard.tsx');
const supplierDashboard = read('components/supplier-dashboard.tsx');
assert.match(customerDashboard, /\/customer\/quotes\/\$\{quote\.id\}\/document/, 'customers must have a document link on quote cards');
assert.match(supplierDashboard, /\/supplier\/quotes\/\$\{quote\.id\}\/document/, 'suppliers must have a document link on quote cards');

console.log('v3.8.0 commercial quotation document regression checks passed.');
