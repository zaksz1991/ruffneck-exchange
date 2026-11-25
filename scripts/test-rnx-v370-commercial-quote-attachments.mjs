import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const migration = read('supabase/migrations/027_rnx_commercial_quote_attachments.sql');
const attachmentLib = read('lib/commercial-quote-attachments.ts');
const messageLib = read('lib/commercial-quote-messages.ts');
const component = read('components/commercial-quote-conversation.tsx');
const customerUpload = read('app/api/customer/quotes/[id]/attachments/route.ts');
const supplierUpload = read('app/api/supplier/quotes/[id]/attachments/route.ts');
const customerDownload = read('app/api/customer/quotes/[id]/attachments/[messageId]/route.ts');
const supplierDownload = read('app/api/supplier/quotes/[id]/attachments/[messageId]/route.ts');
const pkg = JSON.parse(read('package.json'));

assert.match(migration, /create table if not exists public\.rnx_commercial_quote_message_attachments/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.rnx_commercial_quote_message_attachments from public, anon, authenticated/);
assert.match(migration, /grant select, insert on public\.rnx_commercial_quote_message_attachments to service_role/);
assert.match(migration, /references public\.rnx_commercial_quote_messages\(id, quote_id\) on delete cascade/);
assert.match(migration, /file_size_bytes between 1 and 4194304/);
assert.match(migration, /v_attachment_count >= 20/);
assert.match(migration, /QUOTATION_ATTACHMENT_LIMIT/);
assert.match(migration, /application\/pdf/);
assert.match(migration, /image\/jpeg/);
assert.match(migration, /image\/png/);
assert.match(migration, /image\/webp/);
assert.match(migration, /rnx_send_commercial_quote_message\(/);
assert.match(migration, /rnx_send_commercial_quote_attachment/);
assert.match(migration, /p_storage_path !~/);
assert.match(migration, /p_sender_role not in \('customer','supplier'\)/);
assert.match(migration, /storage_path ~/);

assert.match(attachmentLib, /public: false/);
assert.match(attachmentLib, /COMMERCIAL_QUOTE_ATTACHMENT_MAX_BYTES = 4 \* 1024 \* 1024/);
assert.match(attachmentLib, /COMMERCIAL_QUOTE_ATTACHMENT_MAX_FILES_PER_QUOTE = 20/);
assert.match(attachmentLib, /count: 'exact', head: true/);
assert.match(attachmentLib, /detectCommercialQuoteAttachment/);
assert.match(attachmentLib, /declaredMimeIsSupported/);
assert.match(attachmentLib, /optional note, or leave it blank/);
assert.match(attachmentLib, /bytes\.slice\(0, 5\)/);
assert.match(attachmentLib, /RIFF/);
assert.match(attachmentLib, /rnx_send_commercial_quote_attachment/);
assert.match(attachmentLib, /\.remove\(\[storagePath\]\)/);
assert.match(messageLib, /rnx_commercial_quote_message_attachments/);
assert.match(messageLib, /file_name,mime_type,file_size_bytes,created_at/);
assert.doesNotMatch(messageLib, /select\([^)]*storage_path/);

for (const route of [customerUpload, supplierUpload]) {
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /loadCommercialQuoteMessages/);
  assert.match(route, /!access\.canSend/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /uploadCommercialQuoteAttachment/);
  assert.match(route, /status: 201/);
}
assert.match(customerUpload, /currentCustomerId\(\)/);
assert.match(supplierUpload, /getAuthenticatedSupplier\(\)/);
for (const route of [customerDownload, supplierDownload]) {
  assert.match(route, /loadCommercialQuoteMessages/);
  assert.match(route, /\.eq\('quote_id', id\)/);
  assert.match(route, /\.eq\('message_id', messageId\)/);
  assert.match(route, /createSignedUrl\(/);
  assert.match(route, /status: 302/);
  assert.match(route, /Cache-Control/);
}
assert.match(customerDownload, /currentCustomerId\(\)/);
assert.match(supplierDownload, /getAuthenticatedSupplier\(\)/);

assert.match(component, /Share a quotation file/);
assert.match(component, /accept="application\/pdf,image\/jpeg,image\/png,image\/webp/);
assert.match(component, /4 MB/);
assert.match(component, /new FormData\(\)/);
assert.match(component, /Share attachment/);
assert.match(component, /attachmentEndpoint/);
assert.match(component, /message\.attachments/);
assert.match(component, /target="_blank" rel="noreferrer"/);
assert.match(component, /private download link/);

assert.equal(pkg.version, '3.7.0');
assert.ok(pkg.scripts['test:rnx-v370']);
assert.match(pkg.scripts.check, /test:rnx-v370/);
console.log('RNX v3.7.0 private commercial quotation attachment regression checks passed.');
