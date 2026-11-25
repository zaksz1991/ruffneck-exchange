import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-server';

export type QuoteParticipantRole = 'customer' | 'supplier';

export async function loadCommercialQuoteMessages(
  quoteId: string,
  role: QuoteParticipantRole,
  participantId: string,
) {
  const db = supabaseAdmin();
  const ownerColumn = role === 'customer' ? 'customer_id' : 'supplier_application_id';
  const { data: quote, error: quoteError } = await db
    .from('rnx_commercial_quotes')
    .select('id,lead_offer_id,lead_id,customer_id,supplier_application_id,status,valid_until,quote_reference')
    .eq('id', quoteId)
    .eq(ownerColumn, participantId)
    .maybeSingle();
  if (quoteError) throw quoteError;
  if (!quote) return { notFound: true as const };

  if (role === 'customer') {
    const { data: customer, error: customerError } = await db
      .from('rnx_customers')
      .select('id')
      .eq('id', participantId)
      .eq('status', 'active')
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return { notFound: true as const };
  }

  const { data: offer, error: offerError } = await db
    .from('rnx_lead_offers')
    .select('id,lead_id,supplier_application_id,payment_status,payment_verified_at,supplier_accepted_at,customer_approved_at,contact_released_at')
    .eq('id', quote.lead_offer_id)
    .maybeSingle();
  if (offerError) throw offerError;
  const quoteMatchesOffer = Boolean(offer && offer.lead_id === quote.lead_id && offer.supplier_application_id === quote.supplier_application_id);
  const { data: lead, error: leadError } = await db
    .from('rnx_leads')
    .select('id')
    .eq('id', quote.lead_id)
    .eq('customer_id', quote.customer_id)
    .maybeSingle();
  if (leadError) throw leadError;
  const contactReleased = Boolean(
    lead && quoteMatchesOffer && offer && offer.payment_status === 'paid' && offer.payment_verified_at &&
    offer.supplier_accepted_at && offer.customer_approved_at && offer.contact_released_at,
  );
  if (!contactReleased) return { notFound: true as const };

  const { data: messages, error: messagesError } = await db
    .from('rnx_commercial_quote_messages')
    .select('id,sender_role,message_body,created_at')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(150);
  if (messagesError) throw messagesError;

  const messageRows = messages ?? [];
  const messageIds = messageRows.map((message) => message.id);
  const attachmentsByMessage = new Map<string, Array<{
    id: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    created_at: string;
  }>>();
  if (messageIds.length) {
    const { data: attachments, error: attachmentsError } = await db
      .from('rnx_commercial_quote_message_attachments')
      .select('id,message_id,file_name,mime_type,file_size_bytes,created_at')
      .eq('quote_id', quoteId)
      .in('message_id', messageIds);
    if (attachmentsError) throw attachmentsError;
    for (const attachment of attachments ?? []) {
      const current = attachmentsByMessage.get(attachment.message_id) ?? [];
      current.push({
        id: attachment.id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        file_size_bytes: Number(attachment.file_size_bytes),
        created_at: attachment.created_at,
      });
      attachmentsByMessage.set(attachment.message_id, current);
    }
  }

  const { data: outcome, error: outcomeError } = await db
    .from('rnx_transaction_outcomes')
    .select('status')
    .eq('lead_offer_id', quote.lead_offer_id)
    .maybeSingle();
  if (outcomeError) throw outcomeError;
  const outcomeClosed = ['completed', 'cancelled', 'disputed'].includes(outcome?.status || '');
  const canSend = !outcomeClosed && (quote.status === 'submitted' || quote.status === 'selected') &&
    new Date(quote.valid_until).getTime() > Date.now();
  return {
    notFound: false as const,
    quote: { id: quote.id, quote_reference: quote.quote_reference, status: quote.status },
    messages: messageRows.reverse().map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    })),
    canSend,
  };
}
