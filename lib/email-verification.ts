import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-server';

export type RnxVerificationAccountType = 'customer' | 'supplier';
export type VerificationIssueResult = {
  sent: boolean;
  reason: 'sent' | 'not_configured' | 'rate_limited' | 'delivery_failed';
};

function verificationSecret(): string {
  const value = process.env.RNX_EMAIL_VERIFICATION_SECRET?.trim()
    || process.env.RNX_ACCOUNT_RECOVERY_SECRET?.trim()
    || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error('Set RNX_EMAIL_VERIFICATION_SECRET, RNX_ACCOUNT_RECOVERY_SECRET or RNX_ADMIN_SESSION_SECRET to at least 32 characters.');
  }
  return value;
}

function hmacBucket(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function requestIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

async function allowBucket(bucketKey: string, maxRequests: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('rnx_email_verification_allow_request', {
    p_bucket_key: bucketKey,
    p_max_requests: maxRequests,
    p_window_seconds: 900,
  });
  if (error) throw new Error('Email verification rate limiter is unavailable.');
  return data === true;
}

export async function issueRnxEmailVerificationLink(input: {
  accountType: RnxVerificationAccountType;
  accountId: string;
  email: string;
  request: Request;
}): Promise<VerificationIssueResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: 'not_configured' };

  const secret = verificationSecret();
  const email = input.email.trim().toLowerCase();
  const ip = requestIp(input.request);
  const emailBucket = hmacBucket(secret, `rnx-email-verification|${input.accountType}|${email}|${ip}`);
  const ipBucket = hmacBucket(secret, `rnx-email-verification-ip|${ip}`);
  const emailAllowed = await allowBucket(emailBucket, 5);
  const ipAllowed = emailAllowed && await allowBucket(ipBucket, 30);
  if (!emailAllowed || !ipAllowed) return { sent: false, reason: 'rate_limited' };

  const db = supabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const { error: invalidateError } = await db.from('rnx_email_verification_tokens')
    .update({ consumed_at: nowIso })
    .eq('account_type', input.accountType)
    .eq('account_id', input.accountId)
    .is('consumed_at', null);
  if (invalidateError) throw new Error('Existing email verification links could not be invalidated.');

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const { data: tokenRow, error: tokenError } = await db.from('rnx_email_verification_tokens').insert({
    account_type: input.accountType,
    account_id: input.accountId,
    recipient_email: email,
    token_hash: tokenHash,
    expires_at: expiresAt,
  }).select('id').single();
  if (tokenError || !tokenRow) throw new Error('Email verification token could not be created.');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ruffneck-exchange.vercel.app';
  const verifyUrl = new URL('/account/verify-email', baseUrl);
  // Keep the bearer token in the URL fragment so it is not sent in the initial page request.
  verifyUrl.hash = new URLSearchParams({ type: input.accountType, token }).toString();
  const subject = 'Confirm your RuffNeck Exchange email address';
  const bodyText = [
    'Confirm that you control this email address for your RuffNeck Exchange account.',
    '',
    `Account type: ${input.accountType === 'supplier' ? 'Supplier applicant / portal' : 'Customer'}`,
    'Use the secure one-time link below to confirm your email address:',
    verifyUrl.toString(),
    '',
    'This link expires in 60 minutes and can be used once. Requesting a new link invalidates previous links.',
    'If you did not create or request access to a RuffNeck Exchange account, ignore this email.',
    '',
    'RuffNeck Exchange Operations',
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `rnx-email-verification-${tokenRow.id}`,
      },
      body: JSON.stringify({ from, to: [email], subject, text: bodyText }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await db.from('rnx_email_verification_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', tokenRow.id);
      console.error('[RNX email verification] Resend rejected a verification message:', response.status);
      return { sent: false, reason: 'delivery_failed' };
    }
    return { sent: true, reason: 'sent' };
  } catch (error) {
    await db.from('rnx_email_verification_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', tokenRow.id);
    console.error('[RNX email verification] Delivery attempt failed:', error instanceof Error ? error.name : 'unknown error');
    return { sent: false, reason: 'delivery_failed' };
  }
}
