import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/track/[token]/route.ts', import.meta.url), 'utf8');

assert.match(route, /type TrackingTrustCase = \{ id: string; resolution_published_at: string \| null;/);
assert.match(route, /const primaryCasesResult = await db\.from\('rnx_trust_cases'\)/);
assert.match(route, /let casesError = primaryCasesResult\.error;/);
assert.match(route, /const fallbackCasesResult = await db\.from\('rnx_trust_cases'\)/);
assert.match(route, /resolution_published_at: null/);
assert.match(route, /casesError = fallbackCasesResult\.error/);
assert.match(route, /let caseReportingAvailable = !casesError/);
assert.doesNotMatch(route, /let casesResult = await db\.from\('rnx_trust_cases'[\s\S]{0,900}?casesResult = await db\.from\('rnx_trust_cases'/);

console.log('RNX v3.13.1 tracking fallback TypeScript regression checks passed.');
