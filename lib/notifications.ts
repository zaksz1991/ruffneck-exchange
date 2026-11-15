import 'server-only';
import { site } from '@/lib/site';

/** Notifications are always recorded first. Email is attempted only when Resend is configured. */
export async function queueNotification(db: any, input: {
  recipientEmail?: string | null; subject: string; bodyText: string; relatedLeadId?: string | null;
}) {
  if (!input.recipientEmail) return { queued: false, sent: false };
  const { data, error } = await db.from('rnx_notifications').insert({
    channel: 'email', recipient_email: input.recipientEmail.toLowerCase(), subject: input.subject,
    body_text: input.bodyText, related_lead_id: input.relatedLeadId || null, status: 'pending'
  }).select('id').single();
  if (error || !data) {
    console.error('[RNX notifications] Could not queue email:', error?.message || 'unknown error');
    return { queued: false, sent: false };
  }
  return await dispatchNotification(db, data.id);
}

export async function dispatchNotification(db: any, id: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RNX_NOTIFICATION_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { queued: true, sent: false };
  const { data: row, error } = await db.from('rnx_notifications').select('id,recipient_email,subject,body_text,status,attempts').eq('id', id).maybeSingle();
  if (error || !row || row.status === 'sent') return { queued: Boolean(row), sent: row?.status === 'sent' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [row.recipient_email], subject: row.subject, text: row.body_text })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : `Email provider returned ${response.status}.`);
    await db.from('rnx_notifications').update({ status: 'sent', provider_reference: result.id || null, sent_at: new Date().toISOString(), attempts: Number(row.attempts || 0) + 1, last_error: null, updated_at: new Date().toISOString() }).eq('id', id);
    return { queued: true, sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'Email delivery failed.';
    await db.from('rnx_notifications').update({ status: 'failed', attempts: Number(row.attempts || 0) + 1, last_error: message, updated_at: new Date().toISOString() }).eq('id', id);
    console.error('[RNX notifications] Email delivery failed:', message);
    return { queued: true, sent: false };
  }
}

export function trackingUrl(token: string): string { return `${site.url}/track/${token}`; }
