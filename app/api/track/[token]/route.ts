import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashTrackingToken } from '@/lib/customer-auth';
import { queueNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ token: string }> };
const messageSchema = z.object({ body: z.string().trim().min(2).max(3000) });

function isMissingTrustSchema(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || (message.includes('rnx_trust_case') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('not found')));
}

async function findLead(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from('rnx_leads')
    .select('id,request_type,name,state,city,category,details,referenced_listing_slug,referenced_listing_title,referenced_supplier_name,status,contact_release_status,created_at,last_activity_at')
    .eq('tracking_token_hash', hashTrackingToken(token)).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const lead = await findLead(token);
    if (!lead) return NextResponse.json({ error: 'This tracking link is invalid or has expired.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const db = supabaseAdmin();
    const [messagesResult, introductionsResult] = await Promise.all([
      db.from('rnx_lead_messages').select('id,sender_role,sender_name,body,created_at').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(200),
      db.from('rnx_lead_offers').select('id,contact_released_at,supplier:rnx_supplier_applications!inner(business_name,category)').eq('lead_id', lead.id).eq('payment_status', 'paid').not('payment_verified_at', 'is', null).not('customer_approved_at', 'is', null).not('contact_released_at', 'is', null).order('contact_released_at', { ascending: false }).limit(20),
    ]);
    if (messagesResult.error) throw messagesResult.error;
    if (introductionsResult.error) throw introductionsResult.error;

    let caseAppealAvailable = true;
    type TrackingTrustCase = { id: string; resolution_published_at: string | null; [key: string]: unknown };
    const primaryCasesResult = await db.from('rnx_trust_cases')
      .select('id,case_reference,case_type,summary,status,public_resolution,resolution_published_at,created_at,updated_at')
      .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);
    let casesError = primaryCasesResult.error;
    let cases: TrackingTrustCase[] = (primaryCasesResult.data || []) as unknown as TrackingTrustCase[];
    if (casesError && String(casesError.code || '') === '42703') {
      caseAppealAvailable = false;
      const fallbackCasesResult = await db.from('rnx_trust_cases')
        .select('id,case_reference,case_type,summary,status,public_resolution,created_at,updated_at')
        .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);
      casesError = fallbackCasesResult.error;
      // Older installations may not yet have resolution_published_at. Normalise
      // fallback rows to the same response shape without selecting the missing column.
      cases = (fallbackCasesResult.data || []).map((row) => ({
        ...row,
        resolution_published_at: null,
      })) as unknown as TrackingTrustCase[];
    }
    let caseReportingAvailable = !casesError;
    if (casesError && !isMissingTrustSchema(casesError)) throw casesError;
    let caseMessages: any[] = [];
    let caseEvidenceAvailable = true;
    let caseAttachments: any[] = [];
    let caseAppeals: any[] = [];
    if (cases.length && caseReportingAvailable) {
      const result = await db.from('rnx_trust_case_messages').select('id,trust_case_id,sender_role,sender_name,body,created_at').in('trust_case_id', cases.map((row: any) => row.id)).eq('visibility', 'customer').order('created_at', { ascending: true }).limit(300);
      if (result.error && !isMissingTrustSchema(result.error)) throw result.error;
      if (result.error) caseReportingAvailable = false;
      caseMessages = result.data || [];
      const attachmentResult = await db.from('rnx_trust_case_attachments')
        .select('id,trust_case_id,uploader_role,visibility,file_name,mime_type,file_size_bytes,note,created_at')
        .in('trust_case_id', cases.map((row: any) => row.id))
        .eq('visibility', 'customer')
        .order('created_at', { ascending: true })
        .limit(400);
      if (attachmentResult.error) {
        const attachmentCode = String(attachmentResult.error.code || '');
        const attachmentMessage = String(attachmentResult.error.message || '').toLowerCase();
        if (attachmentCode === '42P01' || attachmentCode === 'PGRST205' || attachmentMessage.includes('rnx_trust_case_attachments')) {
          caseEvidenceAvailable = false;
        } else {
          throw attachmentResult.error;
        }
      } else {
        caseAttachments = attachmentResult.data || [];
      }
      if (caseAppealAvailable) {
        const appealResult = await db.from('rnx_trust_case_appeals')
          .select('id,trust_case_id,status,customer_reason,staff_response,created_at,reviewed_at')
          .in('trust_case_id', cases.map((row: any) => row.id))
          .limit(20);
        if (appealResult.error) {
          const appealCode = String(appealResult.error.code || '');
          const appealMessage = String(appealResult.error.message || '').toLowerCase();
          if (appealCode === '42P01' || appealCode === 'PGRST205' || appealMessage.includes('rnx_trust_case_appeals')) caseAppealAvailable = false;
          else throw appealResult.error;
        } else {
          caseAppeals = appealResult.data || [];
        }
      }
    }
    return NextResponse.json({
      request: lead,
      messages: messagesResult.data || [],
      cases: caseReportingAvailable ? cases.map((row: any) => ({
        ...row,
        appeal: caseAppeals.find((appeal: any) => appeal.trust_case_id === row.id) || null,
        messages: caseMessages.filter((message: any) => message.trust_case_id === row.id),
        attachments: caseAttachments.filter((attachment: any) => attachment.trust_case_id === row.id),
      })) : [],
      caseReportingAvailable,
      caseEvidenceAvailable,
      caseAppealAvailable,
      introducedSuppliers: (introductionsResult.data || []).map((row: any) => ({ id: row.id, introduced_at: row.contact_released_at, supplier: Array.isArray(row.supplier) ? row.supplier[0] : row.supplier })),
    }, { headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    console.error('[RNX tracking] Lookup failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Request tracking is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a message of 2 to 3,000 characters.' }, { status: 400 });
  try {
    const { token } = await context.params;
    const lead = await findLead(token);
    if (!lead) return NextResponse.json({ error: 'This tracking link is invalid or has expired.' }, { status: 404 });
    const db = supabaseAdmin();
    const { error } = await db.from('rnx_lead_messages').insert({ lead_id: lead.id, sender_role: 'customer', sender_name: 'Customer', body: parsed.data.body });
    if (error) throw error;
    await db.from('rnx_leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    const ops = process.env.RNX_OPERATIONS_NOTIFICATION_EMAIL?.trim();
    if (ops) await queueNotification(db, { recipientEmail: ops, subject: `New customer message — ${lead.category}`, bodyText: `A customer sent a message about request ${lead.id}. Review it in RNX Operations → Customer communications.`, relatedLeadId: lead.id });
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[RNX tracking] Message failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Your message could not be sent.' }, { status: 503 });
  }
}
