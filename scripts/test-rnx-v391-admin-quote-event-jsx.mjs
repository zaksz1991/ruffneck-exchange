import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../components/admin-commercial-quote-console.tsx', import.meta.url), 'utf8');
assert.match(component, /event\.event_type === 'submitted' && <small>/, 'submitted event rendering must use a boolean condition, not leak an object into ReactNode');
assert.match(component, /event\.event_type === 'revision_requested' && typeof event\.details\.revision_note === 'string' && event\.details\.revision_note\.length > 0 && <small>/, 'revision note rendering must narrow unknown JSON values to a non-empty string before rendering');
assert.doesNotMatch(component, /event\.event_type === 'revision_requested' && event\.details\?\.revision_note && <small>/, 'unknown event detail values must not be used directly as JSX conditional children');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
assert.match(css, /supplier-gallery-upload\{display:flex;align-items:flex-end;/, 'gallery upload alignment must use the broadly supported flex-end value');
console.log('v3.9.1 admin quotation event JSX regression checks passed.');
