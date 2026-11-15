import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'rnx_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function sessionSecret(): string {
  const value = process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error('RNX_ADMIN_SESSION_SECRET must contain at least 32 characters.');
  }
  return value;
}

function signature(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminPassword(candidate: string): boolean {
  const configured = process.env.RNX_ADMIN_PASSWORD;
  if (!configured) return false;
  const key = sessionSecret();
  const expected = createHmac('sha256', key).update(configured).digest('hex');
  const actual = createHmac('sha256', key).update(candidate).digest('hex');
  return safeEqual(actual, expected);
}

export function createAdminSession(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${signature(`rnx-admin:${payload}`)}`;
}

export function isValidAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const separator = token.indexOf('.');
  if (separator < 1) return false;
  const expiresAt = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!/^\d{10}$/.test(expiresAt) || !suppliedSignature) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  try {
    return safeEqual(suppliedSignature, signature(`rnx-admin:${expiresAt}`));
  } catch {
    return false;
  }
}

export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return isValidAdminSession(jar.get(ADMIN_COOKIE)?.value);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
