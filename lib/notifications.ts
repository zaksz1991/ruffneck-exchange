import 'server-only';
import { site } from '@/lib/site';
import { dispatchNotification } from '@/lib/notification-worker';

/**
 * Every outbound email is persisted before delivery is attempted.
 * A configured provider is attempted immediately; the worker retries due failures later.
 */
export async function queueNotification(db: any, input: {
  recipientEmail?: string | null;
  subject: string;
  bodyText: string;
  relatedLeadId?: string | null;
}) {
  if (!input.recipientEmail) return { queued: false, sent: false };
  const { data, error } = await db.from('rnx_notifications').insert({
    channel: 'email',
    recipient_email: input.recipientEmail.trim().toLowerCase(),
    subject: input.subject,
    body_text: input.bodyText,
    related_lead_id: input.relatedLeadId || null,
    status: 'pending',
  }).select('id').single();
  if (error || !data) {
    console.error('[RNX notifications] Could not queue email:', error?.message || 'unknown error');
    return { queued: false, sent: false };
  }
  return await dispatchNotification(db, data.id);
}

export { dispatchNotification };

export function trackingUrl(token: string): string {
  return `${site.url}/track/${token}`;
}
