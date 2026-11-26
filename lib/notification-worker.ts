import 'server-only';

const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 10;
const CONCURRENCY = 3;
const SEND_TIMEOUT_MS = 9_000;
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];

type ClaimedNotification = {
  notification_id: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  attempts: number;
};

type SendResult = {
  sent: boolean;
  retryScheduled: boolean;
  terminalFailure: boolean;
  ambiguous: boolean;
};

function providerConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || '',
    from: process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim() || '',
  };
}

function retryAt(attempts: number): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MS[Math.max(0, Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1))];
  return new Date(Date.now() + delay).toISOString();
}

async function updateFailed(db: any, row: ClaimedNotification, message: string, code: string, retryable: boolean) {
  const nextAttemptAt = retryable ? retryAt(row.attempts) : null;
  const { error } = await db.from('rnx_notifications').update({
    status: 'failed',
    last_error: message.slice(0, 500),
    failure_code: code.slice(0, 80),
    next_attempt_at: nextAttemptAt,
    locked_at: null,
    lock_expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', row.notification_id).eq('status', 'processing');
  if (error) throw new Error('Could not persist notification failure state.');
  return { sent: false, retryScheduled: Boolean(nextAttemptAt), terminalFailure: !nextAttemptAt, ambiguous: false } satisfies SendResult;
}

export async function sendClaimedNotification(db: any, row: ClaimedNotification): Promise<SendResult> {
  const { apiKey, from } = providerConfig();
  if (!apiKey || !from) {
    // Do not claim work until configuration exists. This guard is retained for callers
    // that may invoke the worker directly.
    return { sent: false, retryScheduled: false, terminalFailure: false, ambiguous: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Resend retains idempotency keys for 24 hours. Replays inside that window
        // return the original successful send rather than creating a duplicate.
        'Idempotency-Key': `rnx-notification-${row.notification_id}`,
      },
      body: JSON.stringify({ from, to: [row.recipient_email], subject: row.subject, text: row.body_text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string; error?: string };

    if (!response.ok) {
      const message = typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string' ? payload.error : `Email provider returned HTTP ${response.status}.`;
      const retryable = response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500;
      return await updateFailed(db, row, message, `resend_http_${response.status}`, retryable);
    }

    const { error } = await db.from('rnx_notifications').update({
      status: 'sent',
      provider_reference: typeof payload.id === 'string' ? payload.id : null,
      sent_at: new Date().toISOString(),
      last_error: null,
      failure_code: null,
      next_attempt_at: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.notification_id).eq('status', 'processing');

    if (error) {
      // The provider may already have accepted this message. Leave the processing lease
      // to expire; the next run reuses the same provider idempotency key.
      console.error(`[RNX notifications] Provider accepted notification ${row.notification_id}, but outbox status could not be updated.`);
      return { sent: false, retryScheduled: true, terminalFailure: false, ambiguous: true };
    }
    return { sent: true, retryScheduled: false, terminalFailure: false, ambiguous: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed due to a network error.';
    return await updateFailed(db, row, message, 'provider_network_error', true);
  }
}

export async function runNotificationBatch(db: any, requestedBatchSize = BATCH_LIMIT) {
  const { apiKey, from } = providerConfig();
  if (!apiKey || !from) {
    return { configured: false, claimed: 0, sent: 0, failed: 0, retryScheduled: 0, terminalFailures: 0, ambiguous: 0 };
  }

  const batchSize = Math.max(1, Math.min(Math.floor(requestedBatchSize) || BATCH_LIMIT, BATCH_LIMIT));
  const { data, error } = await db.rpc('rnx_claim_notifications', {
    p_notification_id: null,
    p_batch_size: batchSize,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (error) {
    console.error('[RNX notifications] Claim operation failed:', error.message || 'unknown database error');
    throw new Error('Notification worker database function is unavailable. Apply migration 007 and confirm migrations 001–006.');
  }

  const rows = (Array.isArray(data) ? data : []) as ClaimedNotification[];
  const results: SendResult[] = [];
  let cursor = 0;
  async function work() {
    while (cursor < rows.length) {
      const index = cursor++;
      const row = rows[index];
      try {
        results.push(await sendClaimedNotification(db, row));
      } catch (error) {
        console.error(`[RNX notifications] Could not complete notification ${row.notification_id}:`, error instanceof Error ? error.message : 'unknown error');
        // Leave its short lease in place when persistence itself failed. It will be
        // recovered by a later run without concurrent workers sending it immediately.
        results.push({ sent: false, retryScheduled: true, terminalFailure: false, ambiguous: true });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => work()));

  return {
    configured: true,
    claimed: rows.length,
    sent: results.filter((result) => result.sent).length,
    failed: results.filter((result) => !result.sent && !result.ambiguous).length,
    retryScheduled: results.filter((result) => result.retryScheduled).length,
    terminalFailures: results.filter((result) => result.terminalFailure).length,
    ambiguous: results.filter((result) => result.ambiguous).length,
  };
}

export async function dispatchNotification(db: any, notificationId: string) {
  const { apiKey, from } = providerConfig();
  if (!apiKey || !from) return { queued: true, sent: false };

  const { data, error } = await db.rpc('rnx_claim_notifications', {
    p_notification_id: notificationId,
    p_batch_size: 1,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (error) {
    console.error('[RNX notifications] Could not claim notification:', error.message || 'unknown database error');
    return { queued: true, sent: false };
  }
  const row = Array.isArray(data) ? data[0] as ClaimedNotification | undefined : undefined;
  if (!row) {
    const { data: current } = await db.from('rnx_notifications').select('status').eq('id', notificationId).maybeSingle();
    return { queued: Boolean(current), sent: current?.status === 'sent' };
  }
  const result = await sendClaimedNotification(db, row);
  return { queued: !result.sent, sent: result.sent };
}
