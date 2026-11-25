'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

type ConversationAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

type ConversationMessage = {
  id: string;
  sender_role: 'customer' | 'supplier';
  message_body: string;
  created_at: string;
  attachments: ConversationAttachment[];
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

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CommercialQuoteConversation({ quoteId, quoteReference, audience, canSend }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serverCanSend, setServerCanSend] = useState(canSend);
  const fileInput = useRef<HTMLInputElement>(null);

  const audienceRoot = audience === 'customer' ? '/api/customer/quotes' : '/api/supplier/quotes';
  const endpoint = `${audienceRoot}/${encodeURIComponent(quoteId)}/messages`;
  const attachmentEndpoint = `${audienceRoot}/${encodeURIComponent(quoteId)}/attachments`;

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
  }, [audience, canSend, endpoint]);

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

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setError('');
    setNotice('');
    if (file && file.size > 4 * 1024 * 1024) {
      setSelectedFile(null);
      event.target.value = '';
      setError('The selected file exceeds the 4 MB limit.');
      return;
    }
    if (file && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
      setSelectedFile(null);
      event.target.value = '';
      setError('Choose a PDF, JPEG, PNG or WebP file.');
      return;
    }
    setSelectedFile(file);
  }

  async function uploadAttachment() {
    if (!selectedFile || uploading || selectedFile.size < 1 || selectedFile.size > 4 * 1024 * 1024) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.set('file', selectedFile);
      form.set('message_body', attachmentNote.trim());
      const response = await fetch(attachmentEndpoint, { method: 'POST', body: form });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(audience === 'customer' ? '/customer/login' : '/supplier/login');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Attachment could not be uploaded.');
      setSelectedFile(null);
      setAttachmentNote('');
      if (fileInput.current) fileInput.current.value = '';
      setNotice('Attachment shared. The other participant has been notified.');
      await loadMessages();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Attachment could not be uploaded.');
    } finally {
      setUploading(false);
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
          {!loading && loaded && messages.length === 0 && <p className="fine-print">No messages yet. Use this thread for quotation-specific questions, clarifications and relevant files.</p>}
          {messages.length > 0 && (
            <ol className="rnx-quote-message-list">
              {messages.map((message) => (
                <li key={message.id} className={`rnx-quote-message${message.sender_role === audience ? ' is-own' : ''}`}>
                  <div>
                    <strong>{message.sender_role === audience ? 'You' : audience === 'customer' ? 'Supplier' : 'Customer'}</strong>
                    <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
                  </div>
                  <p>{message.message_body}</p>
                  {message.attachments?.length > 0 && (
                    <ul className="rnx-quote-attachment-list">
                      {message.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <span aria-hidden="true">{attachment.mime_type === 'application/pdf' ? 'PDF' : 'IMG'}</span>
                          <div>
                            <a href={`${attachmentEndpoint}/${encodeURIComponent(message.id)}`} target="_blank" rel="noreferrer">{attachment.file_name}</a>
                            <small>{sizeLabel(attachment.file_size_bytes)} · private download link</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-status" role="status">{notice}</p>}
          {loaded && canSend && serverCanSend ? (
            <>
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
              <div className="rnx-quote-attachment-form">
                <div>
                  <strong>Share a quotation file</strong>
                  <p>PDF, JPEG, PNG or WebP · 4 MB per file · up to 20 files per quotation.</p>
                </div>
                <label>
                  Attachment
                  <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" onChange={chooseFile} />
                </label>
                <label>
                  Optional note
                  <input type="text" maxLength={1000} value={attachmentNote} onChange={(event) => setAttachmentNote(event.target.value)} placeholder="e.g. Updated product specification" />
                </label>
                {selectedFile && <small className="rnx-quote-selected-file">Selected: {selectedFile.name} · {sizeLabel(selectedFile.size)}</small>}
                <button type="button" className="button button-small button-secondary" onClick={() => void uploadAttachment()} disabled={!selectedFile || uploading}>{uploading ? 'Uploading…' : 'Share attachment'}</button>
              </div>
            </>
          ) : loaded ? (
            <p className="fine-print">This quotation is no longer open for new messages or attachments. Earlier messages and shared files remain available for reference.</p>
          ) : null}
          <small className="rnx-quote-conversation-note">Files are held in private storage and downloads require a signed-in conversation participant. Share only material relevant to this quotation. Do not upload passwords, payment credentials or sensitive personal documents. Confirm final agreements and payments independently; RNX does not process this commercial payment.</small>
        </div>
      )}
    </section>
  );
}
