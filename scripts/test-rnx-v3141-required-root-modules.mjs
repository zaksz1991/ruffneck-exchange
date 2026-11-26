import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'lib/analytics-client.ts',
  'lib/admin-auth.ts',
];

for (const relativePath of required) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `Required project module is missing: ${relativePath}`);
  assert.ok(readFileSync(absolutePath, 'utf8').trim().length > 0, `Required project module is empty: ${relativePath}`);
}

const importers = [
  ['components/analytics-consent.tsx', '@/lib/analytics-client'],
  ['components/request-form.tsx', '@/lib/analytics-client'],
  ['components/supplier-form.tsx', '@/lib/analytics-client'],
  ['app/admin/analytics/page.tsx', '@/lib/admin-auth'],
  ['app/admin/communications/page.tsx', '@/lib/admin-auth'],
];

for (const [file, specifier] of importers) {
  const source = readFileSync(path.join(root, file), 'utf8');
  assert.ok(source.includes(specifier), `${file} no longer exercises the required module import: ${specifier}`);
}

const tsconfig = JSON.parse(readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
assert.deepEqual(tsconfig.compilerOptions.paths['@/*'], ['./*'], 'The @/* alias must map to the repository root.');

console.log('v3.14.1 root-module packaging checks passed.');
