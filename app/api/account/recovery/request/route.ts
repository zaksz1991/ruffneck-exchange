import { createHash, createHmac, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  accountType: z.enum(['customer', 'supplier']),
  email: z.string().trim().email().max(254),
});
const genericMessage = 'If an eligible account uses that email address, a password reset link has been requested. The link expires after 60 minutes. Check your inbox and spam folder. For security, RNX does not confirm whether an account exists.';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function recoverySecret(): string {
  const secret = process.env.RNX_ACCOUNT_RECOVERY_SECRET?.trim()
    || process.env.RNX_CUSTOMER_SESSION_SECRET?.trim()
    || process.env.RNX_SUPPLIER_SESSION_SECRET?.trim()
    || process.env.RNX_ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('Account recovery signing secret is not configured.');
  return secret;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: 'Request rejected.' }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Enter a valid account type and email address.' }, 400);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return json({ error: 'Account recovery email is not configured. Contact RNX Operations for account assistance.' }, 503);
  }

  const accountType = parsed.data.accountType;
  const email = parsed.data.email.toLowerCase();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';

  try {
    const secret = recoverySecret();
    const bucketKey = createHmac('sha256', secret)
      .update(`rnx-account-recovery|${accountType}|${email}|${forwarded}`)
      .digest('hex');
    const db = supabaseAdmin();
    const { data: allowed, error: rateError } = await db.rpc('rnx_account_recovery_allow_request', {
      p_bucket_key: bucketKey,
      p_max_requests: 5,
      p_window_seconds: 900,
    });
    if (rateError) {
      console.error('[RNX recovery] Rate limiter unavailable:', rateError.message);
      return json({ error: 'Account recovery is temporarily unavailable. Try again later or contact RNX Operations.' }, 503);
    }
    if (allowed !== true) return json({ ok: true, message: genericMessage });

    const ipBucketKey = createHmac('sha256', secret)
      .update(`rnx-account-recovery-ip|${forwarded}`)
      .digest('hex');
    const { data: ipAllowed, error: ipRateError } = await db.rpc('rnx_account_recovery_allow_request', {
      p_bucket_key: ipBucketKey,
      p_max_requests: 30,
      p_window_seconds: 900,
    });
    if (ipRateError) {
      console.error('[RNX recovery] IP rate limiter unavailable:', ipRateError.message);
      return json({ error: 'Account recovery is temporarily unavailable. Try again later or contact RNX Operations.' }, 503);
    }
    if (ipAllowed !== true) return json({ ok: true, message: genericMessage });

    let account: { id: string; email: string } | null = null;
    if (accountType === 'customer') {
      const { data, error } = await db.from('rnx_customers')
        .select('id,email,status')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw new Error('Customer account lookup failed.');
      if (data) account = { id: data.id, email: data.email };
    } else {
      const { data, error } = await db.from('rnx_supplier_applications')
        .select('id,email,status,portal_enabled')
        .eq('email', email)
        .eq('status', 'approved')
        .eq('portal_enabled', true)
        .maybeSingle();
      if (error) throw new Error('Supplier account lookup failed.');
      if (data) account = { id: data.id, email: data.email };
    }

    if (!account) return json({ ok: true, message: genericMessage });

    const now = new Date();
    const nowIso = now.toISOString();
    const { error: invalidateError } = await db.from('rnx_account_recovery_tokens')
      .update({ consumed_at: nowIso })
      .eq('account_type', accountType)
      .eq('account_id', account.id)
      .is('consumed_at', null);
    if (invalidateError) throw new Error('Existing recovery links could not be invalidated.');

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const { data: tokenRow, error: tokenError } = await db.from('rnx_account_recovery_tokens').insert({
      account_type: accountType,
      account_id: account.id,
      recipient_email: account.email.toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    }).select('id').single();
    if (tokenError || !tokenRow) throw new Error('Recovery token could not be created.');

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ruffneck-exchange.vercel.app';
    const resetUrl = new URL('/account/reset', baseUrl);
    resetUrl.searchParams.set('type', accountType);
    resetUrl.searchParams.set('token', token);
    const accountLabel = accountType === 'supplier' ? 'supplier portal' : 'customer';
    const bodyText = [
      `A password reset was requested for your RuffNeck Exchange ${accountLabel} account.`,
      '',
      'Use the secure one-time link below to choose a new password:',
      resetUrl.toString(),
      '',
      'This link expires in 60 minutes and can be used once. It will stop working after a new reset link is requested.',
      'If you did not request this change, ignore this email. Your password will not change unless the link is used.',
      '',
      'RuffNeck Exchange Operations',
    ].join('\n');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `rnx-account-recovery-${tokenRow.id}`,
        },
        body: JSON.stringify({ from, to: [account.email], subject: 'Reset your RuffNeck Exchange password', text: bodyText }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        await db.from('rnx_account_recovery_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', tokenRow.id);
        console.error('[RNX recovery] Email provider rejected a recovery message:', response.status);
      }
    } catch (error) {
      await db.from('rnx_account_recovery_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', tokenRow.id);
      console.error('[RNX recovery] Email delivery attempt failed:', error instanceof Error ? error.name : 'unknown error');
    }

    return json({ ok: true, message: genericMessage });
  } catch (error) {
    console.error('[RNX recovery] Request could not be processed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Account recovery is temporarily unavailable. Try again later or contact RNX Operations.' }, 503);
  }
}
