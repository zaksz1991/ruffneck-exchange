import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SUPPLIER_COOKIE = 'rnx_supplier_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function sessionSecret(): string {
  const value = process.env.RNX_SUPPLIER_SESSION_SECRET?.trim() || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('Set RNX_SUPPLIER_SESSION_SECRET or use an RNX_ADMIN_SESSION_SECRET containing at least 32 characters.');
  return value;
}

function signature(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(`rnx-supplier:${payload}`).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashSupplierPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifySupplierPassword(password: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [scheme, salt, expectedHex] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expectedHex ?? '')) return false;
  try {
    const actualHex = scryptSync(password, salt, 64).toString('hex');
    return safeEqual(actualHex, expectedHex);
  } catch {
    return false;
  }
}

export function createSupplierSession(supplierId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${supplierId}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function getSupplierIdFromToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [supplierId, expiresAt, suppliedSignature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(supplierId) || !/^\d{10}$/.test(expiresAt) || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  try {
    return safeEqual(suppliedSignature, signature(`${supplierId}.${expiresAt}`)) ? supplierId : null;
  } catch {
    return null;
  }
}

export async function currentSupplierId(): Promise<string | null> {
  const jar = await cookies();
  return getSupplierIdFromToken(jar.get(SUPPLIER_COOKIE)?.value);
}

export function supplierCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}

export async function hasSupplierSession(): Promise<boolean> {
  return Boolean(await currentSupplierId());
}
