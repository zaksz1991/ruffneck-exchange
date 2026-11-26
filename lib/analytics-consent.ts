import 'server-only';
import { cookies } from 'next/headers';

export const ANALYTICS_CONSENT_COOKIE = 'rnx_analytics_consent';

export async function hasAnalyticsConsent(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ANALYTICS_CONSENT_COOKIE)?.value === 'granted';
}

export function analyticsConsentCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  };
}
