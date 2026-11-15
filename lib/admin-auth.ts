import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-server';

export const ADMIN_COOKIE = 'rnx_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

export type StaffRole = 'owner' | 'operations_admin' | 'finance' | 'support' | 'analyst';
export type AdminPermission =
  | 'operations:read' | 'operations:write'
  | 'communications:read' | 'communications:write'
  | 'memberships:read' | 'memberships:write' | 'payments:verify'
  | 'analytics:read' | 'notifications:process' | 'staff:manage';

export type AdminSession = {
  id: string | null;
  email: string;
  fullName: string;
  role: StaffRole;
  isBootstrap: boolean;
};

type SessionPayload = { v: 1; sub: string | null; exp: number };

const permissions: Record<StaffRole, readonly AdminPermission[]> = {
  owner: ['operations:read','operations:write','communications:read','communications:write','memberships:read','memberships:write','payments:verify','analytics:read','notifications:process','staff:manage'],
  operations_admin: ['operations:read','operations:write','communications:read','communications:write','memberships:read','memberships:write','payments:verify','analytics:read','notifications:process'],
  finance: ['memberships:read','memberships:write','payments:verify','analytics:read'],
  support: ['communications:read','communications:write'],
  analyst: ['analytics:read'],
};

function sessionSecret(): string {
  const value = process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('RNX_ADMIN_SESSION_SECRET must contain at least 32 characters.');
  return value;
}

function sign(value: string): string {
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

export function createAdminSession(staffId: string | null): string {
  const payload: SessionPayload = { v: 1, sub: staffId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signed = `v1.${encoded}`;
  return `${signed}.${sign(signed)}`;
}

function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const signed = `${parts[0]}.${parts[1]}`;
  try {
    if (!safeEqual(parts[2], sign(signed))) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (payload.v !== 1 || !(payload.sub === null || typeof payload.sub === 'string') || !Number.isInteger(payload.exp)) return null;
    if ((payload.exp as number) <= Math.floor(Date.now() / 1000)) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const payload = decodeSession(jar.get(ADMIN_COOKIE)?.value);
  if (!payload) return null;

  // The environment-password account is an emergency owner account retained for initial setup.
  if (payload.sub === null) {
    if (!process.env.RNX_ADMIN_PASSWORD?.trim()) return null;
    return {
      id: null,
      email: (process.env.RNX_ADMIN_EMAIL || 'bootstrap-owner@ruffneck-exchange.local').trim().toLowerCase(),
      fullName: 'RNX Owner',
      role: 'owner',
      isBootstrap: true,
    };
  }

  try {
    const { data, error } = await supabaseAdmin().from('rnx_staff_users')
      .select('id,email,full_name,role,status')
      .eq('id', payload.sub).maybeSingle();
    if (error || !data || data.status !== 'active') return null;
    if (!['owner','operations_admin','finance','support','analyst'].includes(data.role)) return null;
    return {
      id: data.id,
      email: String(data.email).toLowerCase(),
      fullName: String(data.full_name),
      role: data.role as StaffRole,
      isBootstrap: false,
    };
  } catch {
    return null;
  }
}

export function hasPermission(role: StaffRole, permission: AdminPermission): boolean {
  return permissions[role].includes(permission);
}

export function permissionsForRole(role: StaffRole): AdminPermission[] {
  return [...permissions[role]];
}

export async function hasAdminSession(): Promise<boolean> {
  return Boolean(await getAdminSession());
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
