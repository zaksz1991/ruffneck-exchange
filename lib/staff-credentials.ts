import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function hashStaffPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyStaffPassword(password: string, encoded: string): boolean {
  try {
    const [scheme, saltText, hashText, extra] = encoded.split('$');
    if (scheme !== 'scrypt' || !saltText || !hashText || extra !== undefined) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = scryptSync(password, salt, 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
