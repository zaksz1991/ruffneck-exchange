import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';

export const CUSTOMER_COOKIE = 'rnx_customer_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function sessionSecret(): string {
  const value = process.env.RNX_CUSTOMER_SESSION_SECRET?.trim() || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('Set RNX_CUSTOMER_SESSION_SECRET or RNX_ADMIN_SESSION_SECRET with at least 32 characters.');
  return value;
}
function signature(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(`rnx-customer:${payload}`).digest('base64url');
}
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function hashCustomerPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyCustomerPassword(password: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [scheme, salt, expected] = encoded.split('$');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(expected || '')) return false;
  try { return safeEqual(scryptSync(password, salt, 64).toString('hex'), expected); } catch { return false; }
}
export function createCustomerSession(customerId: string): string {
  const expires = Math.floor(Date.now()/1000) + SESSION_SECONDS;
  const payload = `${customerId}.${expires}`;
  return `${payload}.${signature(payload)}`;
}
export function getCustomerIdFromToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expires, supplied] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{10}$/.test(expires) || Number(expires) <= Math.floor(Date.now()/1000)) return null;
  try { return safeEqual(supplied, signature(`${id}.${expires}`)) ? id : null; } catch { return null; }
}
export async function currentCustomerId(): Promise<string | null> {
  const jar = await cookies();
  return getCustomerIdFromToken(jar.get(CUSTOMER_COOKIE)?.value);
}
export function customerCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_SECONDS };
}
export function customerSessionConfigured(): boolean {
  const value = process.env.RNX_CUSTOMER_SESSION_SECRET?.trim() || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  return Boolean(value && value.length >= 32);
}
export function hashTrackingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function createTrackingToken(): string { return randomBytes(32).toString('hex'); }
export function customerAttemptKey(email: string, request: Request): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${email.toLowerCase()}|${ip}`).digest('hex');
}
