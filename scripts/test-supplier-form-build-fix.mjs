import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('components/supplier-form.tsx', 'utf8');
const capture = source.indexOf('const formData = new FormData(form);');
const email = source.indexOf("const submittedEmail = String(formData.get('email') ?? '').trim().toLowerCase();");
const payload = source.indexOf('const data = { ...Object.fromEntries(formData.entries()), ...readConsentedAttribution() };');
const reset = source.indexOf('form.reset();');
const save = source.indexOf('setSavedEmail(submittedEmail);');
assert.ok(capture >= 0, 'FormData must be captured');
assert.ok(email > capture, 'Email must be read from FormData');
assert.ok(payload > email, 'Payload is built after the email has been captured');
assert.ok(reset > payload, 'Form reset must happen after submission');
assert.ok(save > reset, 'Captured email must be retained after reset');
assert.doesNotMatch(source, /data\.email/, 'Attribution-merged object must not be used to read email');
console.log('RNX supplier form TypeScript regression contract: PASS');
