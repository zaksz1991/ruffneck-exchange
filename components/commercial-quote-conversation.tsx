'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type ConversationMessage = {
  id: string;
  sender_role: 'customer' | 'supplier';
  message_body: string;
  created_at: string;
};

type Props = {
  quoteId: string;
  quoteReference: string;
  audience: 'customer' | 'supplier';
  canSend: boolean;
};

function timeLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export function CommercialQuoteConversation({ quoteId, quoteReference, audience, canSend }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serverCanSend, setServerCanSend] = useState(canSend);

  const endpoint = `${audience === 'customer' ? '/api/customer/quotes' : '/api/supplier/quotes'}/${encodeURIComponent(quoteId)}/messages`;

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(audience === 'customer' ? '/customer/login' : '/supplier/login');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Conversation could not be loaded.');
      setMessages((result.messages || []) as ConversationMessage[]);
      setServerCanSend(Boolean(result.canSend) && canSend);
      setLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Conversation could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [audience, endpoint]);

  useEffect(() => {
    const expectedHash = `#${audience === 'customer' ? 'quote' : 'supplier-quote'}-${quoteId}`;
    const openFromNotificationLink = () => {
      if (window.location.hash === expectedHash) {
        setOpen(true);
        void loadMessages();
      }
    };
    openFromNotificationLink();
    window.addEventListener('hashchange', openFromNotificationLink);
    return () => window.removeEventListener('hashchange', openFromNotificationLink);
  }, [audience, loadMessages, quoteId]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    setNotice('');
    if (next && !loaded) await loadMessages();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (body.length < 2 || body.length > 2000 || sending) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_body: body }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(audience === 'customer' ? '/customer/login' : '/supplier/login');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Message could not be sent.');
      setDraft('');
      setNotice('Message sent. The other participant has been notified.');
      await loadMessages();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rnx-quote-conversation" aria-label={`Conversation for ${quoteReference}`}>
      <button
        className="button button-small button-secondary rnx-quote-conversation-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => void toggleOpen()}
      >
        {open ? 'Close conversation' : 'Open private conversation'}
      </button>
      {open && (
        <div className="rnx-quote-conversation-body">
          <div className="rnx-quote-conversation-heading">
            <div>
              <strong>{quoteReference}</strong>
              <p>Discuss quotation scope, specifications, delivery details and clarifications with the other participant.</p>
            </div>
            <button type="button" className="button button-small button-secondary" onClick={() => void loadMessages()} disabled={loading}>Refresh</button>
          </div>
          {loading && <p className="fine-print">Loading conversation…</p>}
          {!loading && loaded && messages.length === 0 && <p className="fine-print">No messages yet. Use this thread for quotation-specific questions and clarifications.</p>}
          {messages.length > 0 && (
            <ol className="rnx-quote-message-list">
              {messages.map((message) => (
                <li key={message.id} className={`rnx-quote-message${message.sender_role === audience ? ' is-own' : ''}`}>
                  <div>
                    <strong>{message.sender_role === audience ? 'You' : audience === 'customer' ? 'Supplier' : 'Customer'}</strong>
                    <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
                  </div>
                  <p>{message.message_body}</p>
                </li>
              ))}
            </ol>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-status" role="status">{notice}</p>}
          {canSend && serverCanSend ? (
            <form className="rnx-quote-message-form" onSubmit={(event) => void sendMessage(event)}>
              <label>
                Message
                <textarea rows={3} minLength={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a clear question or clarification…" />
              </label>
              <div>
                <small>{draft.trim().length}/2,000 characters</small>
                <button className="button button-small" type="submit" disabled={sending || draft.trim().length < 2}>{sending ? 'Sending…' : 'Send message'}</button>
              </div>
            </form>
          ) : (
            <p className="fine-print">This quotation is no longer open for new messages. Earlier messages remain available for reference.</p>
          )}
          <small className="rnx-quote-conversation-note">Messages are stored in the RNX quotation record. Do not share passwords or payment credentials. Confirm final agreements and payments independently; RNX does not process this commercial payment.</small>
        </div>
      )}
    </section>
  );
}
